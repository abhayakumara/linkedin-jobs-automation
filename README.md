# ✈️ JobPilot — AI Job Application Autopilot

A single-user, locally-run web app that removes the manual grind of a job search.
Define your target roles and a base resume, and JobPilot will **discover relevant
jobs, tailor your resume to each one with AI, draft cover letters & recruiter
emails, and track every application** through a pipeline — so you spend your time
on interviews, not copy-pasting.

> Built to run on **your own machine**. Nothing is hosted; all your data lives in
> a local SQLite file and your secrets stay in a local `.env`.

---

## ✨ What it does

- **Profiles / personas** — set target roles, optional target companies,
  preferences (remote, locations, salary, seniority, must-have / avoid keywords),
  and a base resume. Switch the active profile so multiple people can use the app
  one at a time.
- **Automatic job discovery** — pulls real jobs from public job APIs and de-dupes
  them. Paste any job (incl. LinkedIn) manually too.
- **🇮🇳 Remote (India) section** — a dedicated view that discovers remote roles
  realistically open to India-based candidates (Worldwide / Asia / India /
  unrestricted listings, plus Adzuna searched against India). It carries the
  **full toolkit** — match scoring, resume tailoring, cover letters, apply, and
  recruiter outreach — just scoped to India-friendly remote jobs.
- **AI match scoring + gap analysis** — every job gets a 0–100 fit score with
  strengths, gaps, and missing keywords (Claude when configured; a keyword
  heuristic otherwise).
- **AI resume tailoring → PDF** — rewrites your base resume for each JD (truthful:
  it reorders & re-emphasizes, never fabricates) and renders a clean PDF.
- **ATS keyword check** — shows which JD keywords made it into your tailored resume.
- **Cover letters & interview prep** — generated per job.
- **Recruiter outreach** — AI-drafted emails with a **review-and-send** workflow by
  default (switchable to auto-send). Sends via your SMTP/Gmail.
- **Pipeline kanban** — drag jobs across Discovered → Shortlisted → Tailored →
  Applied → Interview → Offer / Rejected, plus a dashboard with stats & charts.
- **(Opt-in) LinkedIn automation** — search + Easy-Apply via a logged-in browser.
  ⚠️ **See the warning below — this violates LinkedIn's ToS.**

---

## 🛠 Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma + SQLite ·
Anthropic Claude (`claude-opus-4-8`) · Playwright (PDF + LinkedIn) · Nodemailer · Recharts.

---

## 🚀 Quick start

```bash
# 1. Install dependencies
npm install

# 2. Install the Chromium used for PDF rendering (one time)
npx playwright install chromium

# 3. Configure environment (copy and fill in what you have)
cp .env.example .env
#    → add ANTHROPIC_API_KEY to unlock AI features (optional but recommended)

# 4. Set up the local database (creates dev.db + a starter profile)
npm run setup        # = prisma db push && seed

# 5. Run it
npm run dev          # http://localhost:3000
```

Everything works without any keys — you'll get heuristic match scoring and can
draft/track applications. Adding keys progressively unlocks more:

| Capability        | Env var(s)                          | Without it |
|-------------------|-------------------------------------|------------|
| AI tailoring, cover letters, smart scoring, email drafts | `ANTHROPIC_API_KEY` | Keyword heuristic; AI generation disabled |
| Richer/global job feed | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` ([free](https://developer.adzuna.com/)) | Remotive + Arbeitnow still work with no key |
| Sending recruiter emails | `SMTP_USER`, `SMTP_PASSWORD` ([Gmail app password](https://myaccount.google.com/apppasswords)) | Draft & edit only |

The sidebar shows live **on/off** badges for each integration.

---

## 🧭 How to use it

1. **Profiles** → fill in your details, target roles, preferences, and paste your
   base resume (Markdown). Set it active.
2. **Jobs** → pick sources and hit **Discover jobs**, or **Add manually** to paste
   a job you found anywhere. Each job is scored against your profile.
3. **Open a job** → **Tailor resume** (generates tailored Markdown + PDF + ATS
   check), generate a **Cover letter** and **Interview prep**, then **Apply on
   site** / **Mark as applied**.
4. **Outreach tab** → draft a recruiter email, review it, and **Send**.
5. **Pipeline** → drag cards to track status. **Dashboard** shows your funnel.

---

## ⚠️ LinkedIn automation — read this

LinkedIn has **no public API** for searching or applying to jobs. The optional
automation module drives a logged-in browser to scrape results and submit "Easy
Apply". **This violates LinkedIn's User Agreement and can get your account
restricted or permanently banned.** It is **disabled by default**.

If you accept the risk:

```bash
npm run linkedin:login   # opens a browser; log in manually, then press Enter
```

Then enable it in **Settings → LinkedIn automation**. The recommended, safe path
is the assisted flow: tailor your resume here, then click **Apply on site**.

---

## 🔒 Privacy & safety notes

- **Nothing is hosted.** Data lives in `prisma/dev.db`; generated PDFs in
  `storage/`. Both are git-ignored.
- **Secrets** (API keys, SMTP password) live only in `.env` (git-ignored) — never
  in the database.
- **Resume tailoring is truthful** — the AI reorders and re-emphasizes your real
  experience and surfaces relevant keywords; it is instructed not to invent
  employers, dates, degrees, or metrics.
- **Emails default to review-before-send** to protect your sender reputation and
  avoid spamming recruiters.

---

## 📁 Project layout

```
app/                Next.js pages + API routes
  api/              REST handlers (jobs, profiles, outreach, settings, storage)
components/         UI (Sidebar, JobsBoard, JobDetail, Kanban, Profiles, Settings…)
lib/
  ai/               anthropic.ts (Claude), heuristic.ts (fallback), match.ts
  jobSources/       remotive, arbeitnow, adzuna, manual + aggregator/dedupe
  resume/           markdown→HTML + Playwright PDF
  email/            nodemailer
  automation/       OPT-IN LinkedIn Playwright module
prisma/             schema.prisma (SQLite) + seed
scripts/            linkedin-login.ts
```

## 🧰 Useful scripts

```bash
npm run dev             # start the app (dev)
npm run build           # production build (also runs prisma generate)
npm run setup           # db push + seed
npm run db:studio       # browse the SQLite DB in Prisma Studio
npm run linkedin:login  # capture a LinkedIn session (opt-in automation)
```
