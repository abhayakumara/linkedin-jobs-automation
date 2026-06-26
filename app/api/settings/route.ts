import { NextResponse } from "next/server";
import { getSettings, updateSettings, capabilities } from "@/lib/settings";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings, capabilities: capabilities() });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const settings = await updateSettings(body);
  return NextResponse.json({ settings, capabilities: capabilities() });
}
