export interface IndiaPortal {
  id: string;
  name: string;
  tagline: string;
  buildSearchUrl: (keywords: string[], location?: string) => string;
}

export const INDIA_PORTALS: IndiaPortal[] = [
  {
    id: "naukri",
    name: "Naukri",
    tagline: "India's #1 job site — IT, engineering, corporate",
    buildSearchUrl: (kw, loc) => {
      const q = kw.join(", ");
      let url = `https://www.naukri.com/jobs-in-india?k=${encodeURIComponent(q)}`;
      if (loc) url += `&l=${encodeURIComponent(loc)}`;
      return url;
    },
  },
  {
    id: "linkedin-india",
    name: "LinkedIn India",
    tagline: "Professional network — premium India listings",
    buildSearchUrl: (kw) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(kw.join(" "))}&location=India&geoId=102713980`,
  },
  {
    id: "indeed-india",
    name: "Indeed India",
    tagline: "Large aggregator with India-specific listings",
    buildSearchUrl: (kw, loc) =>
      `https://in.indeed.com/jobs?q=${encodeURIComponent(kw.join(" "))}&l=${encodeURIComponent(loc || "India")}`,
  },
  {
    id: "foundit",
    name: "Foundit (Monster)",
    tagline: "Ex-Monster India — MNC, BPO & enterprise roles",
    buildSearchUrl: (kw) =>
      `https://www.foundit.in/srp/results?query=${encodeURIComponent(kw.join(" "))}`,
  },
  {
    id: "instahyre",
    name: "Instahyre",
    tagline: "Recruiter-driven — tech startups & product companies",
    buildSearchUrl: () => "https://www.instahyre.com/search-jobs/",
  },
  {
    id: "glassdoor-india",
    name: "Glassdoor India",
    tagline: "Jobs + company reviews & salary data",
    buildSearchUrl: (kw) =>
      `https://www.glassdoor.co.in/Job/jobs.htm?sc.keyword=${encodeURIComponent(kw.join(" "))}`,
  },
  {
    id: "timesjobs",
    name: "TimesJobs",
    tagline: "Times Group — diverse India listings across sectors",
    buildSearchUrl: (kw) =>
      `https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&from=submit&txtKeywords=${encodeURIComponent(kw.join("+"))}&txtLocation=India`,
  },
  {
    id: "shine",
    name: "Shine",
    tagline: "HT Media — mid-level & fresher roles",
    buildSearchUrl: (kw) => {
      const slug = kw
        .join("-")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-");
      return `https://www.shine.com/job-search/${slug}-jobs`;
    },
  },
];
