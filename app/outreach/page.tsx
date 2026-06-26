import { prisma } from "@/lib/db";
import { capabilities, getSettings } from "@/lib/settings";
import OutreachManager from "@/components/OutreachManager";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const [rows, caps, settings] = await Promise.all([
    prisma.outreach.findMany({
      include: { job: { select: { title: true, company: true } } },
      orderBy: { createdAt: "desc" },
    }),
    capabilities(),
    getSettings(),
  ]);
  return (
    <OutreachManager
      initial={JSON.parse(JSON.stringify(rows))}
      smtp={caps.smtp}
      emailMode={settings.emailMode}
    />
  );
}
