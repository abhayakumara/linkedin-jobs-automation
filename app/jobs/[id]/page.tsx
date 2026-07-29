import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { capabilities, getSettings } from "@/lib/settings";
import { parseJson } from "@/lib/db";
import { parseProfile } from "@/lib/profile";
import { autofillForProfile } from "@/lib/resume/autofill";
import { MatchAnalysis, AtsKeywords, EMPTY_AUTOFILL } from "@/lib/types";
import JobDetail from "@/components/JobDetail";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { application: true, outreach: { orderBy: { createdAt: "desc" } } },
  });
  if (!job) notFound();

  const [caps, settings, profileRow] = await Promise.all([
    capabilities(),
    getSettings(),
    prisma.profile.findUnique({ where: { id: job.profileId } }),
  ]);

  const profile = profileRow ? parseProfile(profileRow) : null;
  const autofill = profile ? autofillForProfile(profile, profile.autofill) : { ...EMPTY_AUTOFILL };
  const hasBaseResume = Boolean(profile?.raw.baseResume.trim());

  const analysis = parseJson<MatchAnalysis>(job.matchAnalysis, {
    rationale: "",
    strengths: [],
    gaps: [],
    missingKeywords: [],
  });
  const ats = parseJson<AtsKeywords>(job.application?.atsKeywords ?? "{}", { present: [], missing: [] });

  return (
    <JobDetail
      job={JSON.parse(JSON.stringify(job))}
      analysis={analysis}
      ats={ats}
      caps={caps}
      emailMode={settings.emailMode}
      automationEnabled={settings.automationEnabled}
      autofill={autofill}
      hasBaseResume={hasBaseResume}
    />
  );
}
