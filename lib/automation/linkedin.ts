/**
 * ⚠️  OPT-IN LINKEDIN AUTOMATION — USE AT YOUR OWN RISK  ⚠️
 *
 * Automating LinkedIn (scraping job listings, auto-submitting "Easy Apply")
 * VIOLATES LinkedIn's User Agreement and can get your account restricted or
 * permanently banned. This module is disabled by default and only runs when you
 * explicitly enable automation in Settings. LinkedIn's DOM changes frequently,
 * so selectors here are best-effort and may need updating.
 *
 * Login is handled out-of-band by `npm run linkedin:login` (headful), which
 * saves a session to LINKEDIN_SESSION_PATH. This module reuses that session.
 */
import fs from "node:fs";
import { NormalizedJob } from "../types";

const SESSION_PATH = process.env.LINKEDIN_SESSION_PATH || "./.linkedin-session.json";

export function linkedinSessionExists(): boolean {
  try {
    return fs.existsSync(SESSION_PATH) && fs.statSync(SESSION_PATH).size > 0;
  } catch {
    return false;
  }
}

async function newContext(headless = true) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    storageState: linkedinSessionExists() ? SESSION_PATH : undefined,
    viewport: { width: 1280, height: 900 },
  });
  return { browser, context };
}

// Scrape LinkedIn job search results for the given keywords.
export async function searchLinkedInJobs(opts: {
  keywords: string;
  location?: string;
  limit?: number;
}): Promise<NormalizedJob[]> {
  if (!linkedinSessionExists()) {
    throw new Error("No LinkedIn session. Run `npm run linkedin:login` first.");
  }
  const limit = opts.limit ?? 15;
  const { browser, context } = await newContext(true);
  try {
    const page = await context.newPage();
    const params = new URLSearchParams({ keywords: opts.keywords });
    if (opts.location) params.set("location", opts.location);
    await page.goto(`https://www.linkedin.com/jobs/search/?${params.toString()}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    const cards = await page.locator("div.job-card-container, li.jobs-search-results__list-item").all();
    const jobs: NormalizedJob[] = [];
    for (const card of cards.slice(0, limit)) {
      const title = (await card.locator("a.job-card-list__title, a.job-card-container__link").first().textContent().catch(() => ""))?.trim() || "";
      const company = (await card.locator(".job-card-container__primary-description, .artdeco-entity-lockup__subtitle").first().textContent().catch(() => ""))?.trim() || "";
      const location = (await card.locator(".job-card-container__metadata-item").first().textContent().catch(() => ""))?.trim() || "";
      const href = (await card.locator("a.job-card-container__link, a.job-card-list__title").first().getAttribute("href").catch(() => "")) || "";
      if (!title) continue;
      jobs.push({
        source: "linkedin",
        externalId: href.match(/(\d{6,})/)?.[1] || "",
        title,
        company,
        location,
        url: href.startsWith("http") ? href : `https://www.linkedin.com${href}`,
        descriptionText: "",
        salary: "",
        remote: /remote/i.test(location),
        postedAt: null,
      });
    }
    return jobs;
  } finally {
    await browser.close();
  }
}

export interface EasyApplyResult {
  ok: boolean;
  message: string;
}

// Attempt a LinkedIn "Easy Apply" on a job URL. Returns a clear result; does NOT
// guess answers to screening questions — if the form needs more than the basic
// flow, it bails so a human can finish.
export async function easyApply(opts: {
  jobUrl: string;
  resumePdfAbsPath?: string;
}): Promise<EasyApplyResult> {
  if (!linkedinSessionExists()) {
    return { ok: false, message: "No LinkedIn session. Run `npm run linkedin:login` first." };
  }
  const { browser, context } = await newContext(true);
  try {
    const page = await context.newPage();
    await page.goto(opts.jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    const easyBtn = page.locator("button.jobs-apply-button, button:has-text('Easy Apply')").first();
    if ((await easyBtn.count()) === 0) {
      return { ok: false, message: "No Easy Apply button found — this job applies on an external site." };
    }
    await easyBtn.click();
    await page.waitForTimeout(1500);

    // Optionally attach a resume if a file input is present.
    if (opts.resumePdfAbsPath) {
      const fileInput = page.locator("input[type='file']").first();
      if ((await fileInput.count()) > 0) {
        await fileInput.setInputFiles(opts.resumePdfAbsPath).catch(() => {});
      }
    }

    // Single-step applications expose a Submit immediately.
    const submit = page.locator("button[aria-label*='Submit application'], button:has-text('Submit application')").first();
    if ((await submit.count()) > 0) {
      await submit.click();
      await page.waitForTimeout(1500);
      return { ok: true, message: "Submitted via Easy Apply (single step)." };
    }

    // Multi-step forms require screening answers we won't fabricate.
    return {
      ok: false,
      message:
        "This Easy Apply has multiple steps / screening questions. Finish it manually to keep answers accurate.",
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  } finally {
    await browser.close();
  }
}
