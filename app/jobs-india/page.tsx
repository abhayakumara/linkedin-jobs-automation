import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { getSettings, capabilities } from "@/lib/settings";
import { INDIA_PORTALS } from "@/lib/jobSources/indiaPortals";
import { autofillForProfile } from "@/lib/resume/autofill";
import IndiaJobs from "@/components/IndiaJobs";
import { PageHeader, EmptyState } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IndiaJobsPage() {
  const profile = await getActiveProfile();
  if (!profile) {
    return (
      <div>
        <PageHeader title="Jobs — India" />
        <EmptyState
          title="Create a profile first"
          hint="Add your target roles and a base resume, then search Indian job portals with pre-filled keywords."
        />
        <div className="mt-4">
          <Link href="/profiles" className="btn-primary">
            Create a profile
          </Link>
        </div>
      </div>
    );
  }

  const [jobs, settings] = await Promise.all([
    prisma.job.findMany({
      where: { profileId: profile.raw.id },
      include: {
        application: {
          select: { sourceResumeMd: true, status: true, resumePdfPath: true },
        },
      },
      orderBy: [{ matchScore: "desc" }, { fetchedAt: "desc" }],
    }),
    getSettings(),
  ]);

  const caps = capabilities();
  const autofill = autofillForProfile(profile, profile.autofill);
  const keywords = profile.targetRoles.length > 0 ? profile.targetRoles : [];
  const profileLocation = profile.preferences.locations[0] || "";

  return (
    <IndiaJobs
      initialJobs={JSON.parse(JSON.stringify(jobs))}
      portals={INDIA_PORTALS}
      keywords={keywords}
      profileLocation={profileLocation}
      autofill={autofill}
      hasBaseResume={Boolean(profile.raw.baseResume.trim())}
      caps={{ ai: caps.ai, aiProvider: caps.aiProvider }}
      automationEnabled={settings.automationEnabled}
      hasAdzuna={caps.adzuna}
    />
  );
}
