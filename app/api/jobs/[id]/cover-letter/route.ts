import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { aiEnabled, generateCoverLetter } from "@/lib/ai/anthropic";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 400 });
  if (!aiEnabled()) {
    return NextResponse.json({ error: "Cover letters need an ANTHROPIC_API_KEY in .env." }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const coverLetter = await generateCoverLetter(profile, job);
  await prisma.application.upsert({
    where: { jobId: job.id },
    update: { coverLetter },
    create: { jobId: job.id, coverLetter },
  });
  return NextResponse.json({ coverLetter });
}
