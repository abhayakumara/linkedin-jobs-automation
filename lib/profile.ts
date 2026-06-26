import { prisma, parseJson } from "./db";
import { DEFAULT_PREFERENCES, ProfilePreferences } from "./types";
import type { Profile } from "@prisma/client";

export interface ParsedProfile {
  raw: Profile;
  targetRoles: string[];
  targetCompanies: string[];
  preferences: ProfilePreferences;
}

export function parseProfile(p: Profile): ParsedProfile {
  return {
    raw: p,
    targetRoles: parseJson<string[]>(p.targetRoles, []),
    targetCompanies: parseJson<string[]>(p.targetCompanies, []),
    preferences: parseJson<ProfilePreferences>(p.preferences, DEFAULT_PREFERENCES),
  };
}

// The currently active profile, or the most recently updated one as a fallback.
export async function getActiveProfile(): Promise<ParsedProfile | null> {
  let p = await prisma.profile.findFirst({ where: { isActive: true } });
  if (!p) p = await prisma.profile.findFirst({ orderBy: { updatedAt: "desc" } });
  return p ? parseProfile(p) : null;
}

// Make exactly one profile active.
export async function setActiveProfile(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.profile.updateMany({ data: { isActive: false }, where: { isActive: true } }),
    prisma.profile.update({ where: { id }, data: { isActive: true } }),
  ]);
}
