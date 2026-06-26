import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { capabilities, getSettings } from "@/lib/settings";
import { parseJson } from "@/lib/db";
import { MatchAnalysis, AtsKeywords } from "@/lib/types";
import JobDetail from "@/components/JobDetail";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { application: true, outreach: { orderBy: { createdAt: "desc" } } },
  });
  if (!job) notFound();

  const [caps, settings] = await Promise.all([capabilities(), getSettings()]);

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
    />
  );
}
