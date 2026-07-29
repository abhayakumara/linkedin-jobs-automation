import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseProfile } from "@/lib/profile";
import { aiEnabled, tailorResume, generateCoverLetter } from "@/lib/ai/llm";
import { atsKeywordCheck } from "@/lib/ai/heuristic";
import { renderResumePdf } from "@/lib/resume/pdf";
import { extractAutofill, autofillForProfile } from "@/lib/resume/autofill";
import { EMPTY_AUTOFILL } from "@/lib/types";

export const maxDuration = 120;

// One-click prepare-to-apply. In a single call it:
//  1. picks the source resume (job-specific override, else profile base resume),
//  2. tailors it to the JD + renders a PDF (or, with no AI, uses it as-is),
//  3. drafts a cover letter (when AI is available),
//  4. returns the autofill kit (contact + skills + screening answers).
// It sets the job to "tailored" but does NOT mark it applied — the user still
// submits on the employer's site (or via LinkedIn auto-apply). Best-effort:
// individual steps that fail don't sink the whole request.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const wantCover = body.coverLetter !== false;

  const job = await prisma.job.findUnique({ where: { id: params.id }, include: { application: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const profileRow = await prisma.profile.findUnique({ where: { id: job.profileId } });
  if (!profileRow) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  const profile = parseProfile(profileRow);

  const sourceResume = (job.application?.sourceResumeMd || "").trim() || profile.raw.baseResume;
  if (!sourceResume.trim()) {
    return NextResponse.json(
      { error: "No resume to apply with. Add a base resume in Profiles, or paste a specific resume for this job." },
      { status: 400 }
    );
  }

  const ai = aiEnabled();
  const notes: string[] = [];

  // 1–2. Resume markdown (tailored when possible) + PDF.
  let resumeMd = job.application?.tailoredResumeMd || "";
  if (ai) {
    try {
      resumeMd = await tailorResume(profile, job, sourceResume);
    } catch (e) {
      notes.push("Tailoring failed — using your source resume as-is.");
      resumeMd = sourceResume;
    }
  } else if (!resumeMd) {
    // No AI: apply with the chosen source resume unchanged.
    resumeMd = sourceResume;
  }

  const ats = atsKeywordCheck(resumeMd, job.descriptionText);

  let resumePdfPath = job.application?.resumePdfPath || "";
  try {
    resumePdfPath = await renderResumePdf(resumeMd, `${profile.raw.name}-${job.company}-${job.title}`);
  } catch {
    notes.push("PDF render skipped (Chromium unavailable) — markdown is ready.");
  }

  // 3. Cover letter (AI only, best-effort).
  let coverLetter = job.application?.coverLetter || "";
  if (ai && wantCover) {
    try {
      coverLetter = await generateCoverLetter(profile, job);
    } catch {
      notes.push("Cover letter generation failed.");
    }
  }

  await prisma.application.upsert({
    where: { jobId: job.id },
    update: { tailoredResumeMd: resumeMd, resumePdfPath, coverLetter, atsKeywords: JSON.stringify(ats) },
    create: {
      jobId: job.id,
      sourceResumeMd: job.application?.sourceResumeMd || "",
      tailoredResumeMd: resumeMd,
      resumePdfPath,
      coverLetter,
      atsKeywords: JSON.stringify(ats),
    },
  });
  if (job.status === "discovered" || job.status === "shortlisted") {
    await prisma.job.update({ where: { id: job.id }, data: { status: "tailored" } });
  }

  // 4. Autofill kit. Extract from the resume the first time (and cache on profile).
  let stored = profile.autofill;
  const emptyStored = !stored.fullName && !stored.email && !stored.phone && stored.topSkills.length === 0;
  if (emptyStored) {
    try {
      stored = await extractAutofill(sourceResume);
      await prisma.profile.update({ where: { id: profile.raw.id }, data: { autofill: JSON.stringify(stored) } });
    } catch {
      stored = { ...EMPTY_AUTOFILL };
    }
  }
  const autofill = autofillForProfile(profile, stored);

  return NextResponse.json({
    ok: true,
    tailoredResumeMd: resumeMd,
    resumePdfPath,
    pdfOk: Boolean(resumePdfPath),
    ats,
    coverLetter,
    autofill,
    applyUrl: job.url,
    tailored: ai,
    notes,
  });
}
