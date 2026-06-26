import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { getSettings } from "@/lib/settings";
import { SOURCES } from "@/lib/jobSources";
import JobsBoard from "@/components/JobsBoard";
import { PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const profile = await getActiveProfile();
  if (!profile) {
    return (
      <div>
        <PageHeader title="Jobs" />
        <EmptyState title="Create a profile first" hint="JobPilot discovers jobs based on your active profile." />
        <div className="mt-4">
          <Link href="/profiles" className="btn-primary">Create a profile</Link>
        </div>
      </div>
    );
  }

  const [jobs, settings] = await Promise.all([
    prisma.job.findMany({
      where: { profileId: profile.raw.id },
      include: { application: { select: { id: true, resumePdfPath: true } } },
      orderBy: [{ matchScore: "desc" }, { fetchedAt: "desc" }],
    }),
    getSettings(),
  ]);

  const sources = Object.values(SOURCES).map((s) => ({
    id: s.id,
    label: s.label,
    requiresKey: s.requiresKey,
  }));

  return (
    <JobsBoard
      initialJobs={JSON.parse(JSON.stringify(jobs))}
      sources={sources}
      enabledSources={settings.enabledSources}
      roles={profile.targetRoles}
    />
  );
}
