import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { getSettings } from "@/lib/settings";
import { discoverJobs } from "@/lib/jobSources";
import { getMatch } from "@/lib/ai/match";
import { JobSearchCriteria } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const settings = await getSettings();
  const sources: string[] = body.sources?.length ? body.sources : settings.enabledSources;

  const criteria: JobSearchCriteria = {
    roles: profile.targetRoles,
    companies: profile.targetCompanies,
    locations: profile.preferences.locations,
    remote: profile.preferences.remote,
    limitPerSource: body.limitPerSource ?? 15,
  };

  const { jobs, errors } = await discoverJobs(sources, criteria);

  // Persist new jobs (skip ones we already have for this profile by url/externalId).
  let added = 0;
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
      select: { id: true },
    });
    if (exists) continue;
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
        remote: j.remote,
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

  return NextResponse.json({ found: jobs.length, added, scored, errors });
}
