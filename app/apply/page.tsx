import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { getSettings, capabilities } from "@/lib/settings";
import { SOURCES } from "@/lib/jobSources";
import { autofillForProfile } from "@/lib/resume/autofill";
import SmartApply from "@/components/SmartApply";
import { PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const profile = await getActiveProfile();
  if (!profile) {
    return (
      <div>
        <PageHeader title="Smart Apply" />
        <EmptyState title="Create a profile first" hint="Smart Apply searches every source for roles that fit your skills, then applies in one click." />
        <div className="mt-4"><Link href="/profiles" className="btn-primary">Create a profile</Link></div>
      </div>
    );
  }

  const [jobs, settings] = await Promise.all([
    prisma.job.findMany({
      where: { profileId: profile.raw.id },
      include: { application: { select: { sourceResumeMd: true, status: true } } },
      orderBy: [{ matchScore: "desc" }, { fetchedAt: "desc" }],
    }),
    getSettings(),
  ]);

  const sources = Object.values(SOURCES).map((s) => ({ id: s.id, label: s.label, requiresKey: s.requiresKey }));
  const caps = capabilities();
  const autofill = autofillForProfile(profile, profile.autofill);

  return (
    <SmartApply
      initialJobs={JSON.parse(JSON.stringify(jobs))}
      sources={sources}
      enabledSources={settings.enabledSources}
      autofill={autofill}
      hasBaseResume={Boolean(profile.raw.baseResume.trim())}
      caps={{ ai: caps.ai, aiProvider: caps.aiProvider }}
      automationEnabled={settings.automationEnabled}
    />
  );
}
