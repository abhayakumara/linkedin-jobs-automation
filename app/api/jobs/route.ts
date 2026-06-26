import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";

export async function GET(req: Request) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json([]);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const jobs = await prisma.job.findMany({
    where: { profileId: profile.raw.id, ...(status ? { status } : {}) },
    include: { application: { select: { id: true, status: true } } },
    orderBy: [{ matchScore: "desc" }, { fetchedAt: "desc" }],
  });
  return NextResponse.json(jobs);
}
