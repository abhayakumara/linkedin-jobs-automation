import { MatchAnalysis } from "../types";
import type { ParsedProfile } from "../profile";

// Common words to ignore when extracting keywords from a JD.
const STOPWORDS = new Set(
  "a an the and or but for to of in on with at by from as is are be we you our your their this that will have has had not your you'll role team work working experience years strong ability able plus etc using use used join looking seeking candidate candidates job position company please apply".split(
    /\s+/
  )
);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z+#.]{1,}/g) || []).filter(
    (t) => t.length > 2 && !STOPWORDS.has(t)
  );
}

function topKeywords(text: string, n: number): string[] {
  const counts = new Map<string, number>();
  for (const t of tokens(text)) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

// Keyword-overlap based score when no AI key is configured. Honest but rough.
export function heuristicScore(
  profile: ParsedProfile,
  job: { title: string; descriptionText: string }
): { score: number; analysis: MatchAnalysis } {
  const resume = `${profile.raw.baseResume} ${profile.targetRoles.join(" ")} ${profile.raw.headline}`;
  const resumeTokens = new Set(tokens(resume));
  const jdKeywords = topKeywords(job.descriptionText, 25);

  const present = jdKeywords.filter((k) => resumeTokens.has(k));
  const missing = jdKeywords.filter((k) => !resumeTokens.has(k));

  // Title-role alignment bonus.
  const roleMatch = profile.targetRoles.some((r) =>
    r
      .toLowerCase()
      .split(/\s+/)
      .some((w) => w.length > 3 && job.title.toLowerCase().includes(w))
  );

  const overlap = jdKeywords.length ? present.length / jdKeywords.length : 0;
  let score = Math.round(overlap * 80) + (roleMatch ? 20 : 0);
  score = Math.max(5, Math.min(100, score));

  return {
    score,
    analysis: {
      rationale:
        "Heuristic score from keyword overlap between your resume and the job description. " +
        "Add an ANTHROPIC_API_KEY for an AI-quality fit analysis.",
      strengths: present.slice(0, 8),
      gaps: missing.slice(0, 8),
      missingKeywords: missing.slice(0, 12),
    },
  };
}

// ATS keyword presence check for a tailored resume against a JD.
export function atsKeywordCheck(
  resumeMd: string,
  jobDescription: string
): { present: string[]; missing: string[] } {
  const resumeTokens = new Set(tokens(resumeMd));
  const jdKeywords = topKeywords(jobDescription, 25);
  return {
    present: jdKeywords.filter((k) => resumeTokens.has(k)),
    missing: jdKeywords.filter((k) => !resumeTokens.has(k)),
  };
}
