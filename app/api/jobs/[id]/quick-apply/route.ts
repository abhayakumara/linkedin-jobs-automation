import { NextResponse } from "next/server";
import { prepareApplication } from "@/lib/apply/prepare";

export const maxDuration = 120;

// One-click prepare-to-apply. Picks the source resume (job-specific override, else
// profile base resume), tailors it to the JD + renders a PDF, drafts a cover letter
// (when AI is available), and returns the autofill kit. Sets the job to "tailored"
// but does NOT mark it applied — the user still submits on the employer's site.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const result = await prepareApplication(params.id, { coverLetter: body.coverLetter !== false });
  if (!result.ok) {
    const status = result.error === "Job not found" || result.error === "Profile not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
