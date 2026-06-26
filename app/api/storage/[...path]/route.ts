import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

// Serve generated artifacts (resume PDFs) from the local storage/ directory.
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const rel = params.path.join("/");
  const base = path.join(process.cwd(), "storage");
  const abs = path.join(base, rel);
  if (!abs.startsWith(base)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  try {
    const file = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const type = ext === ".pdf" ? "application/pdf" : "application/octet-stream";
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${path.basename(abs)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
