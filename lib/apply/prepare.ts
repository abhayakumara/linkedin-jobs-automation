import { prisma } from "../db";
import { parseProfile } from "../profile";
import { aiEnabled, tailorResume, generateCoverLetter } from "../ai/llm";
import { atsKeywordCheck } from "../ai/heuristic";
import { renderResumePdf } from "../resume/pdf";
import { extractAutofill, autofillForProfile } from "../resume/autofill";
import { AutofillData, AtsKeywords, EMPTY_AUTOFILL } from "../types";

export interface PrepareResult {
  ok: true;
  jobId: string;
  title: string;
  company: string;
  tailoredResumeMd: string;
  resumePdfPath: string;
  pdfOk: boolean;
  ats: AtsKeywords;
  coverLetter: string;
  autofill: AutofillData;
  applyUrl: string;
  tailored: boolean;
  notes: string[];
}

export interface PrepareError {
  ok: false;
  jobId: string;
  error: string;
}

// Prepare a job for application: pick the source resume (job-specific override or
// the profile base resume), tailor it to the JD + render a PDF, optionally draft a
// cover letter, and produce the autofill kit. Persists everything to the
// Application and advances the job to "tailored". Best-effort per step — a failing
// PDF/cover letter doesn't fail the whole prep. Shared by the single Quick Apply
// route and the batch route.
export async function prepareApplication(
  jobId: string,
  opts: { coverLetter?: boolean } = {}
): Promise<PrepareResult | PrepareError> {
  const wantCover = opts.coverLetter !== false;

  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { application: true } });
  if (!job) return { ok: false, jobId, error: "Job not found" };

  const profileRow = await prisma.profile.findUnique({ where: { id: job.profileId } });
  if (!profileRow) return { ok: false, jobId, error: "Profile not found" };
  const profile = parseProfile(profileRow);

  const sourceResume = (job.application?.sourceResumeMd || "").trim() || profile.raw.baseResume;
  if (!sourceResume.trim()) {
    return { ok: false, jobId, error: "No resume to apply with. Add a base resume, or a specific resume for this job." };
  }

  const ai = aiEnabled();
  const notes: string[] = [];

  // Resume markdown (tailored when possible) + PDF.
  let resumeMd = job.application?.tailoredResumeMd || "";
  if (ai) {
    try {
      resumeMd = await tailorResume(profile, job, sourceResume);
    } catch {
      notes.push("Tailoring failed — using your source resume as-is.");
      resumeMd = sourceResume;
    }
  } else if (!resumeMd) {
    resumeMd = sourceResume;
  }

  const ats = atsKeywordCheck(resumeMd, job.descriptionText);

  let resumePdfPath = job.application?.resumePdfPath || "";
  try {
    resumePdfPath = await renderResumePdf(resumeMd, `${profile.raw.name}-${job.company}-${job.title}`);
  } catch {
    notes.push("PDF render skipped (Chromium unavailable) — markdown is ready.");
  }

  // Cover letter (AI only, best-effort).
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

  // Autofill kit. Extract from the resume the first time (and cache on profile).
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

  return {
    ok: true,
    jobId: job.id,
    title: job.title,
    company: job.company,
    tailoredResumeMd: resumeMd,
    resumePdfPath,
    pdfOk: Boolean(resumePdfPath),
    ats,
    coverLetter,
    autofill,
    applyUrl: job.url,
    tailored: ai,
    notes,
  };
}
