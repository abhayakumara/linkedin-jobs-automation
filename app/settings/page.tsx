import { capabilities, getSettings } from "@/lib/settings";
import { SOURCES } from "@/lib/jobSources";
import { linkedinSessionExists } from "@/lib/automation/linkedin";
import SettingsManager from "@/components/SettingsManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, caps] = await Promise.all([getSettings(), capabilities()]);
  const sources = Object.values(SOURCES).map((s) => ({ id: s.id, label: s.label, requiresKey: s.requiresKey }));
  return (
    <SettingsManager
      initial={settings}
      caps={caps}
      sources={sources}
      linkedinSession={linkedinSessionExists()}
    />
  );
}
