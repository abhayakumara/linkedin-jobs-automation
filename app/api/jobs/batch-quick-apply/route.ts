import { NextResponse } from "next/server";
import { prepareApplication } from "@/lib/apply/prepare";

export const maxDuration = 300;

const MAX_BATCH = 25;

// Prepare many jobs at once ("Quick Apply to all above X%"). Runs the same prep as
// single Quick Apply for each job id (tailor + PDF + optional cover letter +
// autofill), sequentially so we don't hammer the LLM. Cover letters default OFF to
// keep bulk runs fast. Returns a per-job summary; each job's status advances to
// "tailored" but nothing is auto-submitted.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.jobIds) ? body.jobIds.filter((x: unknown) => typeof x === "string") : [];
  const wantCover = body.coverLetter === true; // opt-in for batch

  if (ids.length === 0) {
    return NextResponse.json({ error: "No jobs selected." }, { status: 400 });
  }
  const batch = ids.slice(0, MAX_BATCH);

  const results: { jobId: string; ok: boolean; title?: string; company?: string; error?: string; pdfOk?: boolean }[] = [];
  let prepared = 0;
  for (const id of batch) {
    try {
      const r = await prepareApplication(id, { coverLetter: wantCover });
      if (r.ok) {
        prepared++;
        results.push({ jobId: r.jobId, ok: true, title: r.title, company: r.company, pdfOk: r.pdfOk });
      } else {
        results.push({ jobId: r.jobId, ok: false, error: r.error });
      }
    } catch (e) {
      results.push({ jobId: id, ok: false, error: e instanceof Error ? e.message : "Failed" });
    }
  }

  return NextResponse.json({
    requested: ids.length,
    processed: batch.length,
    prepared,
    skipped: ids.length - batch.length, // over the per-run cap
    cap: MAX_BATCH,
    results,
  });
}
