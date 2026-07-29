import { prisma } from "@/lib/db";
import { parseProfile } from "@/lib/profile";
import ProfilesManager from "@/components/ProfilesManager";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const rows = await prisma.profile.findMany({ orderBy: { updatedAt: "desc" } });
  const profiles = rows.map((p) => {
    const parsed = parseProfile(p);
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      location: p.location,
      linkedinUrl: p.linkedinUrl,
      portfolioUrl: p.portfolioUrl,
      headline: p.headline,
      baseResume: p.baseResume,
      isActive: p.isActive,
      targetRoles: parsed.targetRoles,
      targetCompanies: parsed.targetCompanies,
      preferences: parsed.preferences,
      autofill: parsed.autofill,
    };
  });
  return <ProfilesManager initialProfiles={profiles} />;
}
