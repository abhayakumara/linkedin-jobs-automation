import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { resolveStoragePath } from "@/lib/resume/pdf";

export const maxDuration = 120;

// Mark a job as applied. method = "assisted" (default) just records it; method =
// "linkedin" attempts the opt-in Easy Apply automation if it is enabled.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const method: string = body.method === "linkedin" ? "linkedin-auto" : "assisted";

  const job = await prisma.job.findUnique({ where: { id: params.id }, include: { application: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  let automationMessage = "";
  if (method === "linkedin-auto") {
    const settings = await getSettings();
    if (!settings.automationEnabled) {
      return NextResponse.json(
        { error: "LinkedIn automation is disabled. Enable it in Settings (at your own risk)." },
        { status: 400 }
      );
    }
    if (!job.url.includes("linkedin.com")) {
      return NextResponse.json({ error: "This job is not a LinkedIn posting." }, { status: 400 });
    }
    const { easyApply, linkedinSessionExists } = await import("@/lib/automation/linkedin");
    if (!linkedinSessionExists()) {
      return NextResponse.json(
        { error: "No LinkedIn session. Run `npm run linkedin:login` first." },
        { status: 400 }
      );
    }
    const resumeAbs = job.application?.resumePdfPath
      ? resolveStoragePath(job.application.resumePdfPath) || undefined
      : undefined;
    const result = await easyApply({ jobUrl: job.url, resumePdfAbsPath: resumeAbs });
    automationMessage = result.message;
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 200 });
    }
  }

  await prisma.application.upsert({
    where: { jobId: job.id },
    update: { method, status: "submitted", appliedAt: new Date(), notes: automationMessage },
    create: { jobId: job.id, method, status: "submitted", appliedAt: new Date(), notes: automationMessage },
  });
  await prisma.job.update({ where: { id: job.id }, data: { status: "applied" } });

  return NextResponse.json({ ok: true, method, message: automationMessage || "Marked as applied." });
}
