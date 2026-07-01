import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { aiEnabled, generateInterviewPrep } from "@/lib/ai/llm";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 400 });
  if (!aiEnabled()) {
    return NextResponse.json({ error: "Interview prep needs an AI provider configured in .env (set LLM_PROVIDER + its key)." }, { status: 400 });
  }
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const prep = await generateInterviewPrep(profile, job);
  return NextResponse.json(prep);
}
