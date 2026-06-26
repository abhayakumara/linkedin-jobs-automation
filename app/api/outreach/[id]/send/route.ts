import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email/mailer";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const outreach = await prisma.outreach.findUnique({ where: { id: params.id } });
  if (!outreach) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!outreach.recruiterEmail) {
    return NextResponse.json({ error: "Add a recruiter email before sending." }, { status: 400 });
  }

  const profile = await getActiveProfile();
  const settings = await getSettings();
  const result = await sendEmail({
    to: outreach.recruiterEmail,
    subject: outreach.subject,
    body: outreach.body,
    fromName: settings.smtpFromName || profile?.raw.name,
  });

  const updated = await prisma.outreach.update({
    where: { id: params.id },
    data: result.ok
      ? { status: "sent", sentAt: new Date(), error: "" }
      : { status: "failed", error: result.error || "send failed" },
  });
  return NextResponse.json({ ok: result.ok, error: result.error, outreach: updated });
}
