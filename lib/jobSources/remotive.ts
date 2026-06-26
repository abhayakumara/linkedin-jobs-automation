import { JobSearchCriteria, NormalizedJob } from "../types";
import { fetchJson, htmlToText } from "./util";

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  candidate_required_location: string;
  url: string;
  description: string;
  salary: string;
  publication_date: string;
}

// https://remotive.com/api/remote-jobs — public, no API key required.
export async function searchRemotive(criteria: JobSearchCriteria): Promise<NormalizedJob[]> {
  const limit = criteria.limitPerSource ?? 20;
  const query = criteria.roles[0] || "";
  const url = `https://remotive.com/api/remote-jobs?limit=${limit}${
    query ? `&search=${encodeURIComponent(query)}` : ""
  }`;
  const data = await fetchJson<{ jobs: RemotiveJob[] }>(url);
  return (data.jobs || []).slice(0, limit).map((j) => ({
    source: "remotive",
    externalId: String(j.id),
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || "Remote",
    url: j.url,
    descriptionText: htmlToText(j.description).slice(0, 8000),
    salary: j.salary || "",
    remote: true,
    postedAt: j.publication_date ? new Date(j.publication_date) : null,
  }));
}
