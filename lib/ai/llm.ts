import { MatchAnalysis, AutofillData, EMPTY_AUTOFILL } from "../types";
import type { ParsedProfile } from "../profile";
import { complete, aiEnabled } from "./provider";

// Higher-level AI tasks (match scoring, resume tailoring, cover letters, outreach,
// interview prep). Provider selection and the low-level `complete()` call live in
// ./provider — swap Claude / Groq / Gemini / a self-hosted LLM via LLM_PROVIDER.
export { aiEnabled };

// Extract the first JSON object/array from a model response (handles code fences).
function extractJson<T>(text: string, fallback: T): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return fallback;
  const slice = candidate.slice(start);
  try {
    return JSON.parse(slice) as T;
  } catch {
    // try to trim trailing prose after the last closing brace/bracket
    const lastBrace = Math.max(slice.lastIndexOf("}"), slice.lastIndexOf("]"));
    if (lastBrace > 0) {
      try {
        return JSON.parse(slice.slice(0, lastBrace + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    return fallback;
  }
}

function profileSummary(profile: ParsedProfile): string {
  const p = profile.raw;
  return [
    `Name: ${p.name}`,
    p.headline ? `Headline: ${p.headline}` : "",
    profile.targetRoles.length ? `Target roles: ${profile.targetRoles.join(", ")}` : "",
    `Preferences: ${JSON.stringify(profile.preferences)}`,
    "",
    "Base resume:",
    p.baseResume || "(no resume provided)",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Match scoring + gap analysis ──
export async function scoreMatch(
  profile: ParsedProfile,
  job: { title: string; company: string; descriptionText: string }
): Promise<{ score: number; analysis: MatchAnalysis }> {
  const system =
    "You are an expert technical recruiter. Assess how well a candidate fits a job. " +
    "Be honest and specific. Respond with ONLY a JSON object, no prose.";
  const user = `CANDIDATE:\n${profileSummary(profile)}\n\nJOB: ${job.title} at ${job.company}\n${job.descriptionText.slice(
    0,
    6000
  )}\n\nReturn JSON with this exact shape:\n{\n  "score": <integer 0-100 fit>,\n  "rationale": "<2-3 sentence summary of fit>",\n  "strengths": ["<candidate strengths relevant to this job>"],\n  "gaps": ["<missing or weak areas>"],\n  "missingKeywords": ["<important JD keywords/skills not evident in the resume>"]\n}`;

  const text = await complete({ system, user, maxTokens: 1024 });
  const parsed = extractJson<{
    score: number;
    rationale: string;
    strengths: string[];
    gaps: string[];
    missingKeywords: string[];
  }>(text, { score: 0, rationale: "", strengths: [], gaps: [], missingKeywords: [] });

  const score = Math.max(0, Math.min(100, Math.round(parsed.score || 0)));
  return {
    score,
    analysis: {
      rationale: parsed.rationale || "",
      strengths: parsed.strengths || [],
      gaps: parsed.gaps || [],
      missingKeywords: parsed.missingKeywords || [],
    },
  };
}

// ── Resume tailoring ──
// `sourceResume` overrides the profile's base resume when the user picked a
// job-specific resume for this role; otherwise the profile base resume is used.
export async function tailorResume(
  profile: ParsedProfile,
  job: { title: string; company: string; descriptionText: string },
  sourceResume?: string
): Promise<string> {
  const base = (sourceResume && sourceResume.trim()) || profile.raw.baseResume;
  const system =
    "You are an expert resume writer specializing in ATS optimization. You tailor a candidate's " +
    "EXISTING resume to a specific job. CRITICAL RULES: never invent experience, employers, dates, " +
    "degrees, or metrics that are not in the base resume. You may reorder, reword, re-emphasize, and " +
    "surface relevant keywords that truthfully apply. Output clean Markdown only — no commentary.";
  const user = `BASE RESUME (source of truth — do not fabricate beyond this):\n${base}\n\nTARGET JOB: ${job.title} at ${job.company}\nJOB DESCRIPTION:\n${job.descriptionText.slice(
    0,
    6000
  )}\n\nRewrite the resume in Markdown, tailored to this job: lead with the most relevant experience and skills, mirror the JD's terminology where truthful, and keep it concise (one page where possible). Output ONLY the Markdown resume.`;
  return complete({ system, user, maxTokens: 3000 });
}

// ── Parse a resume into structured autofill data (for application forms) ──
export async function parseResumeAutofill(resumeText: string): Promise<AutofillData> {
  const system =
    "You extract structured data from a resume for autofilling job application forms. " +
    "Only use information present in the resume — never invent contact details, titles, or numbers. " +
    "If a field is not present, return an empty string (or empty array for skills). " +
    "Respond with ONLY a JSON object, no prose.";
  const user = `RESUME:\n${resumeText.slice(0, 8000)}\n\nReturn JSON with this exact shape:\n{\n  "fullName": "",\n  "email": "",\n  "phone": "",\n  "location": "",\n  "linkedinUrl": "",\n  "portfolioUrl": "",\n  "currentTitle": "<most recent job title>",\n  "yearsExperience": "<total years of professional experience as a number, best estimate from dates>",\n  "topSkills": ["<up to 12 key skills>"],\n  "summary": "<a truthful 1-2 sentence professional summary>"\n}`;
  const text = await complete({ system, user, maxTokens: 1000 });
  const parsed = extractJson<Partial<AutofillData>>(text, {});
  return {
    ...EMPTY_AUTOFILL,
    ...parsed,
    topSkills: Array.isArray(parsed.topSkills) ? parsed.topSkills.slice(0, 12) : [],
  };
}

// ── Cover letter ──
export async function generateCoverLetter(
  profile: ParsedProfile,
  job: { title: string; company: string; descriptionText: string }
): Promise<string> {
  const system =
    "You write concise, specific, non-generic cover letters (180-280 words). Warm but professional. " +
    "No clichés like 'I am writing to express'. Ground every claim in the candidate's resume.";
  const user = `CANDIDATE:\n${profileSummary(profile)}\n\nJOB: ${job.title} at ${job.company}\n${job.descriptionText.slice(
    0,
    4000
  )}\n\nWrite the cover letter body (no address block). Output plain text only.`;
  return complete({ system, user, maxTokens: 800 });
}

// ── Recruiter outreach email ──
export async function draftRecruiterEmail(
  profile: ParsedProfile,
  job: { title: string; company: string; descriptionText?: string },
  recruiterName?: string
): Promise<{ subject: string; body: string }> {
  const system =
    "You write short, genuine recruiter outreach emails that get replies. 90-140 words. " +
    "Specific to the role and company, confident not desperate, with a clear soft call to action. " +
    "Respond with ONLY a JSON object: { \"subject\": string, \"body\": string }.";
  const user = `CANDIDATE:\n${profileSummary(profile)}\n\nROLE OF INTEREST: ${job.title} at ${job.company}\n${
    job.descriptionText ? job.descriptionText.slice(0, 2500) : ""
  }\nRECRUITER NAME: ${recruiterName || "(unknown)"}\n\nWrite the outreach email expressing interest in this role.`;
  const text = await complete({ system, user, maxTokens: 700 });
  const parsed = extractJson<{ subject: string; body: string }>(text, {
    subject: `Interested in the ${job.title} role at ${job.company}`,
    body: text,
  });
  return {
    subject: parsed.subject || `Interested in the ${job.title} role at ${job.company}`,
    body: parsed.body || text,
  };
}

// ── Interview prep ──
export async function generateInterviewPrep(
  profile: ParsedProfile,
  job: { title: string; company: string; descriptionText: string }
): Promise<{ questions: { q: string; tip: string }[] }> {
  const system =
    "You are an interview coach. Produce likely interview questions for a specific role plus a short " +
    "tip for answering each, personalized to the candidate. Respond with ONLY JSON.";
  const user = `CANDIDATE:\n${profileSummary(profile)}\n\nJOB: ${job.title} at ${job.company}\n${job.descriptionText.slice(
    0,
    4000
  )}\n\nReturn JSON: { "questions": [ { "q": "<question>", "tip": "<how to answer, referencing candidate background>" } ] } with 6-8 questions.`;
  const text = await complete({ system, user, maxTokens: 1500 });
  return extractJson<{ questions: { q: string; tip: string }[] }>(text, { questions: [] });
}
