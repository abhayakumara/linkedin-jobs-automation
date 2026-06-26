"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  UserRound,
  Briefcase,
  Globe,
  KanbanSquare,
  Mail,
  Settings,
  Plane,
  Check,
  ChevronsUpDown,
} from "lucide-react";

interface ProfileLite {
  id: string;
  name: string;
  headline: string;
  isActive: boolean;
}

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/remote-india", label: "Remote (India)", icon: Globe },
  { href: "/applications", label: "Pipeline", icon: KanbanSquare },
  { href: "/outreach", label: "Outreach", icon: Mail },
  { href: "/profiles", label: "Profiles", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  profiles,
  caps,
}: {
  profiles: ProfileLite[];
  caps: { ai: boolean; adzuna: boolean; smtp: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = profiles.find((p) => p.isActive) || profiles[0];

  async function activate(id: string) {
    setBusy(true);
    await fetch(`/api/profiles/${id}/activate`, { method: "POST" });
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-ink-900/70 px-4 py-6 backdrop-blur">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 shadow-lg shadow-brand-900/50">
          <Plane className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-lg font-bold leading-none">JobPilot</div>
          <div className="text-[11px] text-slate-400">Application autopilot</div>
        </div>
      </div>

      {/* Active profile switcher */}
      <div className="relative mb-5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="card card-hover flex w-full items-center justify-between px-3 py-2 text-left"
          disabled={busy}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {active ? active.name : "No profile"}
            </span>
            <span className="block truncate text-[11px] text-slate-400">
              {active?.headline || "Create a profile →"}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-xl">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => activate(p.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <span className="truncate">{p.name}</span>
                {p.isActive && <Check className="h-4 w-4 text-brand-400" />}
              </button>
            ))}
            <Link
              href="/profiles"
              onClick={() => setOpen(false)}
              className="block border-t border-white/10 px-3 py-2 text-sm text-brand-300 hover:bg-white/5"
            >
              + Manage profiles
            </Link>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const activeLink = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                activeLink
                  ? "bg-brand-500/15 text-white ring-1 ring-brand-500/30"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Capability badges */}
      <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-[11px]">
        <CapRow label="AI (Claude)" ok={caps.ai} hint="ANTHROPIC_API_KEY" />
        <CapRow label="Adzuna jobs" ok={caps.adzuna} hint="ADZUNA_APP_ID" />
        <CapRow label="Email (SMTP)" ok={caps.smtp} hint="SMTP_USER" />
      </div>
    </aside>
  );
}

function CapRow({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span
        className={`chip ${ok ? "!border-emerald-500/30 !bg-emerald-500/10 text-emerald-300" : "!border-amber-500/30 !bg-amber-500/10 text-amber-300"}`}
        title={ok ? "Configured" : `Set ${hint} in .env`}
      >
        {ok ? "on" : "off"}
      </span>
    </div>
  );
}
