import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_PREFERENCES } from "@/lib/types";

export async function GET() {
  const profiles = await prisma.profile.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(profiles);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const hadActive = (await prisma.profile.count({ where: { isActive: true } })) > 0;
  const profile = await prisma.profile.create({
    data: {
      name: body.name?.trim() || "New Profile",
      email: body.email || "",
      headline: body.headline || "",
      isActive: !hadActive, // first profile becomes active automatically
      targetRoles: JSON.stringify(body.targetRoles ?? []),
      targetCompanies: JSON.stringify(body.targetCompanies ?? []),
      preferences: JSON.stringify(body.preferences ?? DEFAULT_PREFERENCES),
      baseResume: body.baseResume || "",
    },
  });
  return NextResponse.json(profile);
}
