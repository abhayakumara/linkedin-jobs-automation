import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Lightweight status update used by the pipeline kanban drag-and-drop.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  if (!body.status) return NextResponse.json({ error: "status required" }, { status: 400 });

  await prisma.job.update({ where: { id: params.id }, data: { status: body.status } });

  if (body.status === "applied") {
    await prisma.application.upsert({
      where: { jobId: params.id },
      update: { status: "submitted", appliedAt: new Date() },
      create: { jobId: params.id, status: "submitted", appliedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
