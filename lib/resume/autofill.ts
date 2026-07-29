import { AutofillData, EMPTY_AUTOFILL } from "../types";
import { aiEnabled, parseResumeAutofill } from "../ai/llm";
import type { ParsedProfile } from "../profile";

// Regex-based extraction that works with no AI configured. Deliberately
// conservative — only pulls things it can match confidently.
export function heuristicAutofill(resumeText: string): AutofillData {
  const text = resumeText || "";
  const firstLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const email = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || "";
  // Phone: international or local, 7-15 digits with common separators.
  const phone =
    text.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s{2,}/g, " ").trim() || "";
  const linkedinUrl =
    text.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s)]+/i)?.[0] || "";
  // First non-LinkedIn URL as a portfolio/github.
  const portfolioUrl =
    text
      .match(/https?:\/\/[^\s)]+/gi)
      ?.find((u) => !/linkedin\.com/i.test(u)) || "";

  // Name: the first line that looks like a person's name (2-4 capitalized words,
  // no digits/@), commonly at the very top of a resume.
  let fullName = "";
  for (const line of firstLines.slice(0, 4)) {
    const stripped = line.replace(/^#+\s*/, "").trim(); // markdown heading
    if (
      /^[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,3}$/.test(stripped) &&
      !/@|\d/.test(stripped)
    ) {
      fullName = stripped;
      break;
    }
  }

  // Current title: a line following the name that reads like a role, or the first
  // markdown heading after the name.
  let currentTitle = "";
  const titleHint = firstLines.find((l) =>
    /\b(engineer|developer|designer|manager|analyst|scientist|architect|consultant|lead|specialist|administrator|marketer|writer|director)\b/i.test(
      l
    )
  );
  if (titleHint) currentTitle = titleHint.replace(/^#+\s*/, "").replace(/[|•].*$/, "").trim().slice(0, 80);

  return {
    ...EMPTY_AUTOFILL,
    fullName,
    email,
    phone,
    linkedinUrl,
    portfolioUrl,
    currentTitle,
  };
}

// Extract autofill data using AI when available, else the heuristic. Never throws.
export async function extractAutofill(resumeText: string): Promise<AutofillData> {
  if (!resumeText.trim()) return { ...EMPTY_AUTOFILL };
  if (aiEnabled()) {
    try {
      const ai = await parseResumeAutofill(resumeText);
      // Backfill anything the model missed with heuristic matches.
      const h = heuristicAutofill(resumeText);
      return {
        ...ai,
        email: ai.email || h.email,
        phone: ai.phone || h.phone,
        linkedinUrl: ai.linkedinUrl || h.linkedinUrl,
        portfolioUrl: ai.portfolioUrl || h.portfolioUrl,
        fullName: ai.fullName || h.fullName,
        currentTitle: ai.currentTitle || h.currentTitle,
      };
    } catch {
      /* fall through to heuristic */
    }
  }
  return heuristicAutofill(resumeText);
}

// Merge a profile's own fields on top of resume-derived data (profile wins where
// the user has explicitly filled something in), producing the values shown/used
// for autofilling application forms.
export function autofillForProfile(profile: ParsedProfile, stored: AutofillData): AutofillData {
  const p = profile.raw;
  return {
    ...stored,
    fullName: p.name || stored.fullName,
    email: p.email || stored.email,
    phone: p.phone || stored.phone,
    location: p.location || stored.location,
    linkedinUrl: p.linkedinUrl || stored.linkedinUrl,
    portfolioUrl: p.portfolioUrl || stored.portfolioUrl,
    currentTitle: p.headline || stored.currentTitle,
  };
}
