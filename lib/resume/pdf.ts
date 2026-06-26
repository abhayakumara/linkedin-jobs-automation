import fs from "node:fs/promises";
import path from "node:path";
import { resumeHtmlDocument } from "./markdown";

const STORAGE_DIR = path.join(process.cwd(), "storage", "resumes");

// Render a tailored Markdown resume to a PDF using the pre-installed Chromium.
// Returns a web path under /storage that the UI can link to (served by an API route).
export async function renderResumePdf(resumeMd: string, fileBase: string): Promise<string> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const safeBase = fileBase.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80) || "resume";
  const fileName = `${safeBase}-${Date.now()}.pdf`;
  const filePath = path.join(STORAGE_DIR, fileName);

  // Import Playwright lazily so the app boots even if browsers aren't ready.
  const { chromium } = await import("playwright");
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(resumeHtmlDocument(resumeMd), { waitUntil: "networkidle" });
    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
  } finally {
    await browser.close();
  }
  return `/storage/resumes/${fileName}`;
}

// Resolve a stored web path back to an absolute file path (for the download route).
export function resolveStoragePath(webPath: string): string | null {
  if (!webPath.startsWith("/storage/")) return null;
  const rel = webPath.replace(/^\/storage\//, "");
  const abs = path.join(process.cwd(), "storage", rel);
  if (!abs.startsWith(path.join(process.cwd(), "storage"))) return null; // guard traversal
  return abs;
}
