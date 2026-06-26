import { MatchAnalysis } from "../types";
import type { ParsedProfile } from "../profile";
import { aiEnabled, scoreMatch as aiScoreMatch } from "./anthropic";
import { heuristicScore } from "./heuristic";

// Score a job for a profile using AI when available, otherwise the heuristic.
// Never throws — falls back to the heuristic on any AI error.
export async function getMatch(
  profile: ParsedProfile,
  job: { title: string; company: string; descriptionText: string }
): Promise<{ score: number; analysis: MatchAnalysis; engine: "ai" | "heuristic" }> {
  if (aiEnabled()) {
    try {
      const r = await aiScoreMatch(profile, job);
      return { ...r, engine: "ai" };
    } catch {
      // fall through to heuristic
    }
  }
  return { ...heuristicScore(profile, job), engine: "heuristic" };
}
