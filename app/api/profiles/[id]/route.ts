import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const k of ["name", "email", "phone", "location", "linkedinUrl", "portfolioUrl", "headline", "baseResume"]) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.targetRoles !== undefined) data.targetRoles = JSON.stringify(body.targetRoles);
  if (body.targetCompanies !== undefined) data.targetCompanies = JSON.stringify(body.targetCompanies);
  if (body.preferences !== undefined) data.preferences = JSON.stringify(body.preferences);

  const profile = await prisma.profile.update({ where: { id: params.id }, data });
  return NextResponse.json(profile);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const target = await prisma.profile.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.profile.delete({ where: { id: params.id } });

  // If we removed the active profile, promote another one.
  if (target.isActive) {
    const next = await prisma.profile.findFirst({ orderBy: { updatedAt: "desc" } });
    if (next) await prisma.profile.update({ where: { id: next.id }, data: { isActive: true } });
  }
  return NextResponse.json({ ok: true });
}
