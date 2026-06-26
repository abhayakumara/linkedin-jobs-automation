import { JobSearchCriteria, NormalizedJob } from "../types";
import { fetchJson, htmlToText } from "./util";
import { filterByCriteria } from "./index";

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  location: string;
  job_types: string[];
  created_at: number;
}

// https://www.arbeitnow.com/api/job-board-api — public, no API key. No server-side
// search, so we fetch the board and filter client-side by the target roles.
export async function searchArbeitnow(criteria: JobSearchCriteria): Promise<NormalizedJob[]> {
  const limit = criteria.limitPerSource ?? 20;
  const data = await fetchJson<{ data: ArbeitnowJob[] }>("https://www.arbeitnow.com/api/job-board-api");
  const all: NormalizedJob[] = (data.data || []).map((j) => ({
    source: "arbeitnow",
    externalId: j.slug,
    title: j.title,
    company: j.company_name,
    location: j.location || (j.remote ? "Remote" : ""),
    url: j.url,
    descriptionText: htmlToText(j.description).slice(0, 8000),
    salary: "",
    remote: Boolean(j.remote),
    postedAt: j.created_at ? new Date(j.created_at * 1000) : null,
  }));
  const filtered = filterByCriteria(all, criteria);
  return (filtered.length ? filtered : all).slice(0, limit);
}
