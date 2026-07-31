import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { atsKeywordCheck } from "@/lib/ai/heuristic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 400 });

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: { title: true, descriptionText: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const resumeMd = profile.raw.baseResume;
  if (!resumeMd.trim()) {
    return NextResponse.json({
      present: [],
      missing: [],
      tips: ["Add a base resume on the Profiles page so we can analyze keyword gaps against this JD."],
    });
  }

  if (!job.descriptionText.trim()) {
    return NextResponse.json({
      present: [],
      missing: [],
      tips: ["This job has no description text — keyword analysis is not possible."],
    });
  }

  const { present, missing } = atsKeywordCheck(resumeMd, job.descriptionText);

  const tips: string[] = [];

  if (missing.length > 0) {
    tips.push(
      `Add these keywords to your skills or experience sections: ${missing.slice(0, 8).join(", ")}.`
    );
  }

  if (missing.length > 3) {
    tips.push(
      'Add a "Technical Skills" or "Core Competencies" section listing the tools, frameworks, and methodologies the JD mentions.'
    );
  }

  if (present.length > 0 && present.length < 5) {
    tips.push(
      `Your resume already mentions: ${present.join(", ")}. Move these higher or expand on projects that used them.`
    );
  } else if (present.length >= 5) {
    tips.push(
      `Good coverage — your resume already has ${present.length} of the top JD keywords. Focus on quantifying achievements (numbers, %, business impact).`
    );
  }

  const titleWords = job.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const resumeLower = resumeMd.toLowerCase();
  const missingFromTitle = titleWords.filter((w) => !resumeLower.includes(w));
  if (missingFromTitle.length > 0) {
    tips.push(
      `The job title uses "${missingFromTitle.join(", ")}" — include these in your headline or summary so ATS picks it up.`
    );
  }

  if (missing.length === 0 && present.length > 0) {
    tips.push(
      "Your resume covers the main JD keywords. Match the exact phrasing used in the JD (e.g. if they say 'CI/CD pipelines', use that phrase, not just 'deployment')."
    );
  }

  tips.push(
    "Mirror the JD's opening paragraph in your resume summary — ATS systems weigh the top of your resume heavily."
  );

  if (missing.length > 5) {
    tips.push(
      "Rewrite 2-3 experience bullet points to directly mention the technologies and methods from the JD, backed by concrete results."
    );
  }

  return NextResponse.json({ present, missing, tips });
}
