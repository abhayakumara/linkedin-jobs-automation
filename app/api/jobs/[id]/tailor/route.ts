import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { aiEnabled, tailorResume } from "@/lib/ai/anthropic";
import { atsKeywordCheck } from "@/lib/ai/heuristic";
import { renderResumePdf } from "@/lib/resume/pdf";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 400 });
  if (!profile.raw.baseResume.trim()) {
    return NextResponse.json({ error: "Add a base resume to your profile first." }, { status: 400 });
  }
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "Resume tailoring needs an ANTHROPIC_API_KEY in .env." },
      { status: 400 }
    );
  }

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const tailoredResumeMd = await tailorResume(profile, job);
  const ats = atsKeywordCheck(tailoredResumeMd, job.descriptionText);

  // Render a PDF (best-effort — if Chromium fails, keep the markdown).
  let resumePdfPath = "";
  try {
    resumePdfPath = await renderResumePdf(tailoredResumeMd, `${profile.raw.name}-${job.company}-${job.title}`);
  } catch (e) {
    console.error("PDF render failed:", e);
  }

  await prisma.application.upsert({
    where: { jobId: job.id },
    update: { tailoredResumeMd, resumePdfPath, atsKeywords: JSON.stringify(ats) },
    create: { jobId: job.id, tailoredResumeMd, resumePdfPath, atsKeywords: JSON.stringify(ats) },
  });
  if (job.status === "discovered" || job.status === "shortlisted") {
    await prisma.job.update({ where: { id: job.id }, data: { status: "tailored" } });
  }

  return NextResponse.json({ tailoredResumeMd, resumePdfPath, ats, pdfOk: Boolean(resumePdfPath) });
}
