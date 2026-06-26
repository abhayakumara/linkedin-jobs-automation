import Anthropic from "@anthropic-ai/sdk";
import { MatchAnalysis } from "../types";
import type { ParsedProfile } from "../profile";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env to enable AI features.");
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Low-level helper: send a prompt, return text. Optionally ask for JSON.
async function complete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

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
export async function tailorResume(
  profile: ParsedProfile,
  job: { title: string; company: string; descriptionText: string }
): Promise<string> {
  const system =
    "You are an expert resume writer specializing in ATS optimization. You tailor a candidate's " +
    "EXISTING resume to a specific job. CRITICAL RULES: never invent experience, employers, dates, " +
    "degrees, or metrics that are not in the base resume. You may reorder, reword, re-emphasize, and " +
    "surface relevant keywords that truthfully apply. Output clean Markdown only — no commentary.";
  const user = `BASE RESUME (source of truth — do not fabricate beyond this):\n${profile.raw.baseResume}\n\nTARGET JOB: ${job.title} at ${job.company}\nJOB DESCRIPTION:\n${job.descriptionText.slice(
    0,
    6000
  )}\n\nRewrite the resume in Markdown, tailored to this job: lead with the most relevant experience and skills, mirror the JD's terminology where truthful, and keep it concise (one page where possible). Output ONLY the Markdown resume.`;
  return complete({ system, user, maxTokens: 3000 });
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
