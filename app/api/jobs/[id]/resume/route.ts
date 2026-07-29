import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Choose the SOURCE resume for this job: pass a job-specific resume to use instead
// of the profile's base resume, or an empty string to fall back to the base resume.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const sourceResumeMd = typeof body.sourceResumeMd === "string" ? body.sourceResumeMd : "";

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  await prisma.application.upsert({
    where: { jobId: job.id },
    update: { sourceResumeMd },
    create: { jobId: job.id, sourceResumeMd },
  });

  return NextResponse.json({ ok: true, sourceResumeMd });
}
