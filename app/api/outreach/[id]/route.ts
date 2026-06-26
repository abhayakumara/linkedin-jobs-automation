import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const k of ["recruiterName", "recruiterEmail", "subject", "body", "status"]) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  const outreach = await prisma.outreach.update({ where: { id: params.id }, data });
  return NextResponse.json(outreach);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.outreach.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
