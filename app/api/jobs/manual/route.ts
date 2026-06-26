import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { getMatch } from "@/lib/ai/match";

// Add a job manually — paste a title/company/JD (covers LinkedIn jobs the user finds).
export async function POST(req: Request) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  if (!body.title || !body.descriptionText) {
    return NextResponse.json({ error: "Title and job description are required." }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      profileId: profile.raw.id,
      source: "manual",
      title: body.title.trim(),
      company: (body.company || "").trim(),
      location: (body.location || "").trim(),
      url: (body.url || "").trim(),
      descriptionText: body.descriptionText,
      remote: /remote/i.test(body.location || ""),
      status: "shortlisted",
    },
  });

  try {
    const { score, analysis } = await getMatch(profile, job);
    await prisma.job.update({
      where: { id: job.id },
      data: { matchScore: score, matchAnalysis: JSON.stringify(analysis) },
    });
  } catch {
    /* ignore scoring errors */
  }

  return NextResponse.json(job);
}
