import { prisma, parseJson } from "./db";

export interface AppSettings {
  emailMode: "review" | "auto";
  automationEnabled: boolean;
  matchThreshold: number;
  enabledSources: string[];
  smtpFromName: string;
}

// Always returns settings, creating the singleton row on first access.
export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return {
    emailMode: row.emailMode === "auto" ? "auto" : "review",
    automationEnabled: row.automationEnabled,
    matchThreshold: row.matchThreshold,
    enabledSources: parseJson<string[]>(row.enabledSources, ["remotive", "arbeitnow"]),
    smtpFromName: row.smtpFromName,
  };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  await prisma.settings.update({
    where: { id: "singleton" },
    data: {
      ...(patch.emailMode !== undefined ? { emailMode: patch.emailMode } : {}),
      ...(patch.automationEnabled !== undefined ? { automationEnabled: patch.automationEnabled } : {}),
      ...(patch.matchThreshold !== undefined ? { matchThreshold: patch.matchThreshold } : {}),
      ...(patch.enabledSources !== undefined
        ? { enabledSources: JSON.stringify(patch.enabledSources) }
        : {}),
      ...(patch.smtpFromName !== undefined ? { smtpFromName: patch.smtpFromName } : {}),
    },
  });
  return getSettings();
}

// Runtime capability checks (used to show status badges in the UI).
export function capabilities() {
  return {
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    adzuna: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    smtp: Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  };
}
