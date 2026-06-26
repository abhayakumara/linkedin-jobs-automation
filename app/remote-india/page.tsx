import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { SOURCES } from "@/lib/jobSources";
import JobsBoard from "@/components/JobsBoard";
import { PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RemoteIndiaPage() {
  const profile = await getActiveProfile();
  if (!profile) {
    return (
      <div>
        <PageHeader title="Remote (India)" />
        <EmptyState title="Create a profile first" hint="This section finds remote jobs you can work from India." />
        <div className="mt-4"><Link href="/profiles" className="btn-primary">Create a profile</Link></div>
      </div>
    );
  }

  // Only jobs flagged as workable-from-India belong in this section.
  const jobs = await prisma.job.findMany({
    where: { profileId: profile.raw.id, indiaRemote: true },
    include: { application: { select: { id: true, resumePdfPath: true } } },
    orderBy: [{ matchScore: "desc" }, { fetchedAt: "desc" }],
  });

  // India-relevant sources: Remotive (Worldwide/India listings, no key) and
  // Adzuna scoped to India (needs key); Arbeitnow available but EU-heavy.
  const sources = Object.values(SOURCES).map((s) => ({ id: s.id, label: s.label, requiresKey: s.requiresKey }));

  return (
    <JobsBoard
      initialJobs={JSON.parse(JSON.stringify(jobs))}
      sources={sources}
      enabledSources={["remotive", "adzuna"]}
      roles={profile.targetRoles}
      heading="Remote jobs — workable from India 🇮🇳"
      subtitle={`Remote roles open to India for: ${profile.targetRoles.join(", ") || "set roles in Profiles"}`}
      discoverBody={{ indiaRemote: true }}
      banner="Discovery is filtered to remote roles realistically open to India-based candidates (Worldwide / Asia / India / unrestricted), and Adzuna is searched against India listings. Every job here has the full toolkit — tailor resume, cover letter, apply, and recruiter outreach."
    />
  );
}
