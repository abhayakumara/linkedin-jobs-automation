import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { resolveStoragePath } from "@/lib/resume/pdf";

export const maxDuration = 120;

// Bundle the tailored resume PDFs into a single .zip download. Pass jobIds to limit
// to a set (e.g. the current Smart Apply selection); otherwise every job with a
// tailored PDF for the active profile is included.
export async function POST(req: Request) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const jobIds: string[] | undefined = Array.isArray(body.jobIds)
    ? body.jobIds.filter((x: unknown) => typeof x === "string")
    : undefined;

  const jobs = await prisma.job.findMany({
    where: {
      profileId: profile.raw.id,
      ...(jobIds && jobIds.length ? { id: { in: jobIds } } : {}),
      application: { is: { resumePdfPath: { not: "" } } },
    },
    select: { title: true, company: true, application: { select: { resumePdfPath: true } } },
  });

  if (jobs.length === 0) {
    return NextResponse.json(
      { error: "No tailored resume PDFs yet. Run Quick Apply (or Batch Quick Apply) first." },
      { status: 400 }
    );
  }

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;

  for (const job of jobs) {
    const webPath = job.application?.resumePdfPath;
    if (!webPath) continue;
    const abs = resolveStoragePath(webPath);
    if (!abs) continue;
    try {
      const data = await fs.readFile(abs);
      // Human-friendly, unique file name per resume.
      let name = `${job.company || "Company"}-${job.title || "Role"}`.replace(/[^a-z0-9-_ ]+/gi, "_").slice(0, 80).trim();
      let candidate = `${name}.pdf`;
      let n = 2;
      while (used.has(candidate.toLowerCase())) candidate = `${name} (${n++}).pdf`;
      used.add(candidate.toLowerCase());
      zip.file(candidate, data);
      added++;
    } catch {
      /* skip files that vanished */
    }
  }

  if (added === 0) {
    return NextResponse.json({ error: "Tailored PDFs could not be read from storage." }, { status: 400 });
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  // Copy into a fresh, plain-ArrayBuffer-backed view so the type is a concrete
  // ArrayBuffer (satisfies BlobPart under strict typed-array generics).
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `JobPilot-resumes-${stamp}.zip`;

  return new NextResponse(new Blob([out], { type: "application/zip" }), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(out.length),
    },
  });
}
