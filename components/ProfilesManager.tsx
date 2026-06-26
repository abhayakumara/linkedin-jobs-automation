"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProfilePreferences } from "@/lib/types";
import { UserRound, Plus, Trash2, Check, Save, Loader2, Upload } from "lucide-react";

interface ProfileForm {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  headline: string;
  baseResume: string;
  isActive: boolean;
  targetRoles: string[];
  targetCompanies: string[];
  preferences: ProfilePreferences;
}

export default function ProfilesManager({ initialProfiles }: { initialProfiles: ProfileForm[] }) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [selectedId, setSelectedId] = useState(initialProfiles.find((p) => p.isActive)?.id || initialProfiles[0]?.id || "");
  const selected = profiles.find((p) => p.id === selectedId) || null;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function patchSelected(patch: Partial<ProfileForm>) {
    setProfiles((ps) => ps.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)));
  }
  function patchPrefs(patch: Partial<ProfilePreferences>) {
    if (!selected) return;
    patchSelected({ preferences: { ...selected.preferences, ...patch } });
  }

  async function createProfile() {
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Profile" }),
    });
    const created = await res.json();
    const form: ProfileForm = {
      id: created.id, name: created.name, email: "", phone: "", location: "", linkedinUrl: "",
      portfolioUrl: "", headline: "", baseResume: "", isActive: created.isActive,
      targetRoles: [], targetCompanies: [],
      preferences: { remote: true, locations: [], minSalary: 0, seniority: "mid", mustHave: [], avoid: [] },
    };
    setProfiles((ps) => [form, ...ps]);
    setSelectedId(created.id);
    router.refresh();
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMsg("");
    await fetch(`/api/profiles/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected),
    });
    setSaving(false);
    setMsg("Saved ✓");
    setTimeout(() => setMsg(""), 3000);
    router.refresh();
  }

  async function activate(id: string) {
    await fetch(`/api/profiles/${id}/activate`, { method: "POST" });
    setProfiles((ps) => ps.map((p) => ({ ...p, isActive: p.id === id })));
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this profile and all its jobs?")) return;
    await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    const remaining = profiles.filter((p) => p.id !== id);
    setProfiles(remaining);
    setSelectedId(remaining[0]?.id || "");
    router.refresh();
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patchSelected({ baseResume: String(reader.result || "") });
    reader.readAsText(file);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profiles</h1>
        <button onClick={createProfile} className="btn-primary"><Plus className="h-4 w-4" /> New profile</button>
      </div>
      <p className="text-sm text-slate-400">
        Each profile is a separate persona (target roles, preferences, resume). Switch the active profile
        to let different people use JobPilot one at a time.
      </p>

      <div className="grid gap-4 lg:grid-cols-4">
        {/* list */}
        <div className="space-y-2 lg:col-span-1">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`card card-hover cursor-pointer p-3 ${p.id === selectedId ? "!border-brand-500/50" : ""}`}
              onClick={() => setSelectedId(p.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-brand-400" />
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                {p.isActive && <span className="chip !border-emerald-500/30 text-emerald-300">active</span>}
              </div>
              <div className="mt-1 truncate text-xs text-slate-400">{p.headline || "—"}</div>
              {!p.isActive && (
                <button onClick={(e) => { e.stopPropagation(); activate(p.id); }} className="mt-2 text-xs text-brand-300 hover:underline">
                  Set active
                </button>
              )}
            </div>
          ))}
        </div>

        {/* editor */}
        {selected ? (
          <div className="card space-y-5 p-5 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit profile</h2>
              <div className="flex items-center gap-2">
                {msg && <span className="text-sm text-emerald-300">{msg}</span>}
                {!selected.isActive && (
                  <button onClick={() => activate(selected.id)} className="btn-ghost"><Check className="h-4 w-4" /> Set active</button>
                )}
                <button onClick={() => remove(selected.id)} className="btn-danger"><Trash2 className="h-4 w-4" /></button>
                <button onClick={save} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name"><input className="input" value={selected.name} onChange={(e) => patchSelected({ name: e.target.value })} /></Field>
              <Field label="Headline"><input className="input" value={selected.headline} onChange={(e) => patchSelected({ headline: e.target.value })} placeholder="Senior Frontend Engineer" /></Field>
              <Field label="Email"><input className="input" value={selected.email} onChange={(e) => patchSelected({ email: e.target.value })} /></Field>
              <Field label="Phone"><input className="input" value={selected.phone} onChange={(e) => patchSelected({ phone: e.target.value })} /></Field>
              <Field label="Location"><input className="input" value={selected.location} onChange={(e) => patchSelected({ location: e.target.value })} /></Field>
              <Field label="LinkedIn URL"><input className="input" value={selected.linkedinUrl} onChange={(e) => patchSelected({ linkedinUrl: e.target.value })} /></Field>
              <Field label="Portfolio / GitHub"><input className="input" value={selected.portfolioUrl} onChange={(e) => patchSelected({ portfolioUrl: e.target.value })} /></Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target roles"><TagInput tags={selected.targetRoles} onChange={(t) => patchSelected({ targetRoles: t })} placeholder="e.g. Frontend Engineer" /></Field>
              <Field label="Target companies (optional)"><TagInput tags={selected.targetCompanies} onChange={(t) => patchSelected({ targetCompanies: t })} placeholder="e.g. Stripe" /></Field>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Preferences</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.preferences.remote} onChange={(e) => patchPrefs({ remote: e.target.checked })} className="accent-brand-500" />
                  Open to remote
                </label>
                <Field label="Seniority">
                  <select className="input" value={selected.preferences.seniority} onChange={(e) => patchPrefs({ seniority: e.target.value })}>
                    {["intern", "junior", "mid", "senior", "lead", "principal"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Min salary (annual)"><input type="number" className="input" value={selected.preferences.minSalary} onChange={(e) => patchPrefs({ minSalary: Number(e.target.value) })} /></Field>
                <Field label="Preferred locations"><TagInput tags={selected.preferences.locations} onChange={(t) => patchPrefs({ locations: t })} placeholder="e.g. Berlin" /></Field>
                <Field label="Must-have keywords"><TagInput tags={selected.preferences.mustHave} onChange={(t) => patchPrefs({ mustHave: t })} placeholder="e.g. React" /></Field>
                <Field label="Avoid keywords"><TagInput tags={selected.preferences.avoid} onChange={(t) => patchPrefs({ avoid: t })} placeholder="e.g. on-call" /></Field>
              </div>
            </div>

            <Field label="Base resume (Markdown)">
              <div className="mb-2">
                <label className="btn-ghost cursor-pointer text-xs">
                  <Upload className="h-3.5 w-3.5" /> Upload .txt/.md
                  <input type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={onUpload} />
                </label>
              </div>
              <textarea className="input h-72 resize-none font-mono text-xs" value={selected.baseResume} onChange={(e) => patchSelected({ baseResume: e.target.value })} placeholder="# Your Name&#10;Use Markdown. This is the source of truth JobPilot tailors per job." />
            </Field>
          </div>
        ) : (
          <div className="card grid place-items-center p-10 text-slate-400 lg:col-span-3">
            Create a profile to begin.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [value, setValue] = useState("");
  function add() {
    const v = value.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setValue("");
  }
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="chip !border-brand-500/30 text-brand-200">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="ml-1 text-slate-400 hover:text-white">×</button>
          </span>
        ))}
      </div>
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
      />
    </div>
  );
}
