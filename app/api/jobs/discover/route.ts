import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { getSettings } from "@/lib/settings";
import { discoverJobs } from "@/lib/jobSources";
import { isIndiaRemoteEligible } from "@/lib/jobSources/india";
import { getMatch } from "@/lib/ai/match";
import { JobSearchCriteria } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const settings = await getSettings();
  const indiaRemote: boolean = Boolean(body.indiaRemote);
  const countryOverride: string | undefined = typeof body.country === "string" ? body.country : undefined;
  const sources: string[] = body.sources?.length ? body.sources : settings.enabledSources;

  const criteria: JobSearchCriteria = {
    // For India-remote mode, bias the query toward remote roles.
    roles: indiaRemote ? profile.targetRoles.map((r) => `${r} remote`) : profile.targetRoles,
    companies: profile.targetCompanies,
    locations: profile.preferences.locations,
    remote: profile.preferences.remote,
    limitPerSource: body.limitPerSource ?? 15,
    // Adzuna is country-scoped: search India listings when in India-remote mode,
    // or when a country is explicitly passed (e.g. from the India Jobs page).
    ...(indiaRemote ? { country: "in" } : {}),
    ...(countryOverride ? { country: countryOverride } : {}),
  };

  const discovery = await discoverJobs(sources, criteria);
  let jobs = discovery.jobs;
  const errors = discovery.errors;

  // In India-remote mode, keep only jobs realistically workable from India.
  if (indiaRemote) jobs = jobs.filter(isIndiaRemoteEligible);

  // Persist new jobs (skip ones we already have for this profile by url/externalId).
  let added = 0;
  let tagged = 0;
  const createdJobs: { id: string; title: string; company: string; descriptionText: string }[] = [];
  for (const j of jobs) {
    const exists = await prisma.job.findFirst({
      where: {
        profileId: profile.raw.id,
        OR: [
          j.url ? { url: j.url } : { id: "__none__" },
          j.externalId ? { source: j.source, externalId: j.externalId } : { id: "__none__" },
        ],
      },
      select: { id: true, indiaRemote: true },
    });
    if (exists) {
      // If a known job qualifies for the India section, tag it so it shows there.
      if (indiaRemote && !exists.indiaRemote) {
        await prisma.job.update({ where: { id: exists.id }, data: { indiaRemote: true } });
        tagged++;
      }
      continue;
    }
    const created = await prisma.job.create({
      data: {
        profileId: profile.raw.id,
        source: j.source,
        externalId: j.externalId,
        title: j.title,
        company: j.company,
        location: j.location,
        url: j.url,
        descriptionText: j.descriptionText,
        salary: j.salary,
        remote: indiaRemote ? true : j.remote,
        indiaRemote,
        postedAt: j.postedAt,
      },
      select: { id: true, title: true, company: true, descriptionText: true },
    });
    createdJobs.push(created);
    added++;
  }

  // Score the newly added jobs (AI if available, else heuristic). Cap to keep it snappy.
  let scored = 0;
  for (const job of createdJobs.slice(0, 25)) {
    try {
      const { score, analysis } = await getMatch(profile, job);
      await prisma.job.update({
        where: { id: job.id },
        data: { matchScore: score, matchAnalysis: JSON.stringify(analysis) },
      });
      scored++;
    } catch {
      /* leave unscored */
    }
  }

  return NextResponse.json({ found: jobs.length, added, scored, tagged, indiaRemote, errors });
}
