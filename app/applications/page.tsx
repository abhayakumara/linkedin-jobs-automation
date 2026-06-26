import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import PipelineKanban from "@/components/PipelineKanban";
import { PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const profile = await getActiveProfile();
  if (!profile) {
    return (
      <div>
        <PageHeader title="Pipeline" />
        <EmptyState title="Create a profile first" />
        <div className="mt-4"><Link href="/profiles" className="btn-primary">Create a profile</Link></div>
      </div>
    );
  }

  const jobs = await prisma.job.findMany({
    where: { profileId: profile.raw.id, NOT: { status: "skipped" } },
    select: { id: true, title: true, company: true, status: true, matchScore: true },
    orderBy: [{ matchScore: "desc" }],
  });

  return <PipelineKanban initialJobs={jobs} />;
}
