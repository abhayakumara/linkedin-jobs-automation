// Shared application types.

export interface ProfilePreferences {
  remote: boolean;
  locations: string[];
  minSalary: number;
  seniority: string; // intern | junior | mid | senior | lead
  mustHave: string[];
  avoid: string[];
}

export const DEFAULT_PREFERENCES: ProfilePreferences = {
  remote: true,
  locations: [],
  minSalary: 0,
  seniority: "mid",
  mustHave: [],
  avoid: [],
};

export interface MatchAnalysis {
  rationale: string;
  strengths: string[];
  gaps: string[];
  missingKeywords: string[];
}

export interface AtsKeywords {
  present: string[];
  missing: string[];
}

// Structured data parsed from a resume, used to autofill application forms and
// to feed the (opt-in) LinkedIn automation. Contact fields prefill the profile;
// the screening-answer fields are user-editable defaults for common questions.
export interface AutofillData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  currentTitle: string;
  yearsExperience: string; // free text, e.g. "6"
  topSkills: string[];
  summary: string; // 1-2 sentence professional summary
  // Common screening answers (defaults the user can edit once, reused everywhere).
  workAuthorization: string; // e.g. "Authorized to work in India"
  noticePeriod: string; // e.g. "30 days"
  expectedSalary: string;
  willingToRelocate: string; // "Yes" | "No" | ""
}

export const EMPTY_AUTOFILL: AutofillData = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  linkedinUrl: "",
  portfolioUrl: "",
  currentTitle: "",
  yearsExperience: "",
  topSkills: [],
  summary: "",
  workAuthorization: "",
  noticePeriod: "",
  expectedSalary: "",
  willingToRelocate: "",
};

// A job in the shape returned by any JobSource before it is persisted.
export interface NormalizedJob {
  source: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  descriptionText: string;
  salary: string;
  remote: boolean;
  postedAt: Date | null;
}

export interface JobSearchCriteria {
  roles: string[];
  companies: string[];
  locations: string[];
  remote: boolean;
  limitPerSource?: number;
  country?: string; // override for sources that are country-scoped (e.g. Adzuna "in")
}

export const JOB_STATUSES = [
  "discovered",
  "shortlisted",
  "tailored",
  "applied",
  "interview",
  "offer",
  "rejected",
  "skipped",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// Statuses shown as columns on the pipeline kanban (in order).
export const PIPELINE_COLUMNS: JobStatus[] = [
  "discovered",
  "shortlisted",
  "tailored",
  "applied",
  "interview",
  "offer",
  "rejected",
];

export const STATUS_LABELS: Record<string, string> = {
  discovered: "Discovered",
  shortlisted: "Shortlisted",
  tailored: "Tailored",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  skipped: "Skipped",
};
