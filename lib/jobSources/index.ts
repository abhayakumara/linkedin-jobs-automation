import { JobSearchCriteria, NormalizedJob } from "../types";
import { searchRemotive } from "./remotive";
import { searchArbeitnow } from "./arbeitnow";
import { searchAdzuna } from "./adzuna";

export interface JobSource {
  id: string;
  label: string;
  requiresKey: boolean;
  search: (criteria: JobSearchCriteria) => Promise<NormalizedJob[]>;
}

export const SOURCES: Record<string, JobSource> = {
  remotive: {
    id: "remotive",
    label: "Remotive (remote jobs, no key)",
    requiresKey: false,
    search: searchRemotive,
  },
  arbeitnow: {
    id: "arbeitnow",
    label: "Arbeitnow (EU/remote, no key)",
    requiresKey: false,
    search: searchArbeitnow,
  },
  adzuna: {
    id: "adzuna",
    label: "Adzuna (global, free API key)",
    requiresKey: true,
    search: searchAdzuna,
  },
};

// Run the enabled sources, merge, and de-duplicate by company+title (and url).
export async function discoverJobs(
  enabledSourceIds: string[],
  criteria: JobSearchCriteria
): Promise<{ jobs: NormalizedJob[]; errors: { source: string; message: string }[] }> {
  const errors: { source: string; message: string }[] = [];
  const results = await Promise.all(
    enabledSourceIds
      .map((id) => SOURCES[id])
      .filter(Boolean)
      .map(async (src) => {
        try {
          return await src.search(criteria);
        } catch (e) {
          errors.push({ source: src.id, message: e instanceof Error ? e.message : String(e) });
          return [] as NormalizedJob[];
        }
      })
  );

  const seen = new Set<string>();
  const jobs: NormalizedJob[] = [];
  for (const job of results.flat()) {
    const key = `${job.company.toLowerCase().trim()}|${job.title.toLowerCase().trim()}`;
    const urlKey = job.url.toLowerCase().trim();
    if (seen.has(key) || (urlKey && seen.has(urlKey))) continue;
    seen.add(key);
    if (urlKey) seen.add(urlKey);
    jobs.push(job);
  }
  return { jobs, errors };
}

// Lightweight relevance filter so sources without role search still return useful jobs.
export function filterByCriteria(jobs: NormalizedJob[], criteria: JobSearchCriteria): NormalizedJob[] {
  const roleTerms = criteria.roles.flatMap((r) => r.toLowerCase().split(/\s+/)).filter((t) => t.length > 2);
  if (roleTerms.length === 0) return jobs;
  return jobs.filter((j) => {
    const hay = `${j.title} ${j.descriptionText}`.toLowerCase();
    return roleTerms.some((t) => hay.includes(t));
  });
}
