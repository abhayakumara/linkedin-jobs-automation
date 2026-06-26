import { NextResponse } from "next/server";
import { setActiveProfile } from "@/lib/profile";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await setActiveProfile(params.id);
  return NextResponse.json({ ok: true });
}
