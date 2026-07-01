import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { getSettings } from "@/lib/settings";
import { aiEnabled, draftRecruiterEmail } from "@/lib/ai/llm";
import { sendEmail } from "@/lib/email/mailer";

export const maxDuration = 120;

// Draft (and, in auto mode, send) a recruiter outreach email for a specific job.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const recruiterName: string = body.recruiterName || "";
  const recruiterEmail: string = body.recruiterEmail || "";

  let subject = `Interested in the ${job.title} role at ${job.company}`;
  let emailBody = "";
  if (aiEnabled()) {
    const draft = await draftRecruiterEmail(profile, job, recruiterName);
    subject = draft.subject;
    emailBody = draft.body;
  } else {
    emailBody = `Hi ${recruiterName || "there"},\n\nI'm very interested in the ${job.title} role at ${job.company}. My background in ${profile.targetRoles[0] || "this field"} aligns well with what you're looking for, and I'd love to share how I can contribute.\n\nWould you be open to a quick chat?\n\nBest,\n${profile.raw.name}`;
  }

  const settings = await getSettings();
  const outreach = await prisma.outreach.create({
    data: {
      jobId: job.id,
      company: job.company,
      recruiterName,
      recruiterEmail,
      subject,
      body: emailBody,
      status: "draft",
    },
  });

  // Auto-send only if enabled AND we have a recipient + SMTP.
  if (settings.emailMode === "auto" && recruiterEmail) {
    const result = await sendEmail({
      to: recruiterEmail,
      subject,
      body: emailBody,
      fromName: settings.smtpFromName || profile.raw.name,
    });
    await prisma.outreach.update({
      where: { id: outreach.id },
      data: result.ok
        ? { status: "sent", sentAt: new Date() }
        : { status: "failed", error: result.error || "send failed" },
    });
    return NextResponse.json({ ...outreach, status: result.ok ? "sent" : "failed", autoSent: result.ok, error: result.error });
  }

  return NextResponse.json(outreach);
}
