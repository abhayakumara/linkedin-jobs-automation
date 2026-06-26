import { JobSearchCriteria, NormalizedJob } from "../types";
import { fetchJson, htmlToText } from "./util";

interface AdzunaResult {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  redirect_url: string;
  description: string;
  salary_min?: number;
  salary_max?: number;
  created: string;
}

// https://developer.adzuna.com/ — free API key (ADZUNA_APP_ID / ADZUNA_APP_KEY).
export async function searchAdzuna(criteria: JobSearchCriteria): Promise<NormalizedJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Adzuna is enabled but ADZUNA_APP_ID / ADZUNA_APP_KEY are missing in .env");
  }
  const country = (criteria.country || process.env.ADZUNA_COUNTRY || "us").toLowerCase();
  const limit = criteria.limitPerSource ?? 20;
  const what = criteria.roles.join(" ") || "software";
  const where = criteria.locations[0] || "";

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(limit),
    what,
    "content-type": "application/json",
  });
  if (where) params.set("where", where);
  if (criteria.companies[0]) params.set("company", criteria.companies[0]);

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
  const data = await fetchJson<{ results: AdzunaResult[] }>(url);

  return (data.results || []).map((j) => {
    const salary =
      j.salary_min && j.salary_max
        ? `${Math.round(j.salary_min).toLocaleString()} - ${Math.round(j.salary_max).toLocaleString()}`
        : "";
    return {
      source: "adzuna",
      externalId: String(j.id),
      title: j.title,
      company: j.company?.display_name || "",
      location: j.location?.display_name || "",
      url: j.redirect_url,
      descriptionText: htmlToText(j.description).slice(0, 8000),
      salary,
      remote: /remote/i.test(`${j.title} ${j.location?.display_name || ""}`),
      postedAt: j.created ? new Date(j.created) : null,
    };
  });
}
