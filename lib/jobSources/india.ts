import { NormalizedJob } from "../types";

// Locations that clearly include India-based remote candidates.
const INDIA_FRIENDLY = /(india|worldwide|anywhere|global(ly)?|asia|apac|emea\b|south asia)/i;

// Regions that, when named without an India/worldwide qualifier, signal the role
// is restricted to a geography that excludes India.
const OTHER_REGION_ONLY =
  /(u\.?s\.?a?\b|united states|americas|north america|latin america|latam|brazil|mexico|argentina|canada|europe|^eu\b|\beu\b|uk\b|united kingdom|ireland|germany|france|spain|netherlands|australia|new zealand|singapore only|philippines only)/i;

/**
 * Heuristic: is this remote job realistically workable from India?
 *  - Explicit India / Worldwide / Asia / APAC signals  → eligible
 *  - Explicit other-region restriction (US/EU/UK/etc.)  → not eligible
 *  - Ambiguous / empty / "Remote" / "Anywhere"          → assume eligible
 * Adzuna results fetched with country="in" are India-based and pass by default.
 */
export function isIndiaRemoteEligible(job: NormalizedJob): boolean {
  const hay = `${job.location}`.trim();
  if (INDIA_FRIENDLY.test(hay)) return true;
  if (OTHER_REGION_ONLY.test(hay)) return false;
  return true;
}
