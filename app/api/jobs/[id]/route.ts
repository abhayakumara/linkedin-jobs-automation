import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { application: true, outreach: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.status !== undefined) data.status = body.status;

  const job = await prisma.job.update({ where: { id: params.id }, data });

  // Keep application timestamps in sync when a job is marked applied.
  if (body.status === "applied") {
    await prisma.application.upsert({
      where: { jobId: params.id },
      update: { status: "submitted", appliedAt: new Date() },
      create: { jobId: params.id, status: "submitted", appliedAt: new Date() },
    });
  }
  return NextResponse.json(job);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.job.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
