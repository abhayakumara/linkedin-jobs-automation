import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractAutofill } from "@/lib/resume/autofill";

export const maxDuration = 120;

// Parse the profile's base resume into structured autofill data and backfill any
// empty profile contact fields. Uses AI when configured, else a regex heuristic.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const profile = await prisma.profile.findUnique({ where: { id: params.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.baseResume.trim()) {
    return NextResponse.json({ error: "Add a base resume first, then extract details." }, { status: 400 });
  }

  const autofill = await extractAutofill(profile.baseResume);

  // Only fill fields the user hasn't set yet — never overwrite their own edits.
  const backfill: Record<string, string> = {};
  if (!profile.name || profile.name === "New Profile") if (autofill.fullName) backfill.name = autofill.fullName;
  if (!profile.email && autofill.email) backfill.email = autofill.email;
  if (!profile.phone && autofill.phone) backfill.phone = autofill.phone;
  if (!profile.location && autofill.location) backfill.location = autofill.location;
  if (!profile.linkedinUrl && autofill.linkedinUrl) backfill.linkedinUrl = autofill.linkedinUrl;
  if (!profile.portfolioUrl && autofill.portfolioUrl) backfill.portfolioUrl = autofill.portfolioUrl;
  if (!profile.headline && autofill.currentTitle) backfill.headline = autofill.currentTitle;

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: { autofill: JSON.stringify(autofill), ...backfill },
  });

  return NextResponse.json({ autofill, profile: updated, backfilled: Object.keys(backfill) });
}
