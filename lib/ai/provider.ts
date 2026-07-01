import Anthropic from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Pluggable LLM provider layer.
//
// One low-level `complete()` fronts every provider so the rest of the app is
// provider-agnostic. Pick a provider with LLM_PROVIDER in .env:
//
//   LLM_PROVIDER = claude | groq | gemini | custom
//
// - claude : Anthropic (paid, highest quality)         → ANTHROPIC_API_KEY
// - groq   : Groq (free, fast, OpenAI-compatible)       → GROQ_API_KEY
// - gemini : Google Gemini (generous free tier)         → GEMINI_API_KEY
// - custom : any OpenAI-compatible endpoint — your own  → CUSTOM_LLM_BASE_URL
//            self-hosted LLM (Ollama, LM Studio, vLLM,     (+ optional key/model)
//            LocalAI) or OpenAI itself.
//
// If LLM_PROVIDER is unset, the first configured provider is auto-detected
// (claude → groq → gemini → custom), so upgrading to Claude later is just a
// matter of adding ANTHROPIC_API_KEY (and optionally LLM_PROVIDER=claude).
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderId = "claude" | "groq" | "gemini" | "custom";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  model: string;
  configured: boolean;
  /** Env var(s) the user must set to enable this provider. */
  envHint: string;
}

const ORDER: ProviderId[] = ["claude", "groq", "gemini", "custom"];

const LABELS: Record<ProviderId, string> = {
  claude: "Claude (Anthropic)",
  groq: "Groq",
  gemini: "Gemini (Google)",
  custom: "Custom LLM",
};

const ENV_HINT: Record<ProviderId, string> = {
  claude: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
  custom: "CUSTOM_LLM_BASE_URL",
};

// Accept friendly aliases so users aren't tripped up by naming.
function normalizeId(raw?: string): ProviderId | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "claude" || v === "anthropic") return "claude";
  if (v === "groq") return "groq";
  if (v === "gemini" || v === "google") return "gemini";
  if (v === "custom" || v === "openai" || v === "ollama" || v === "local" || v === "self-hosted")
    return "custom";
  return null;
}

function isConfigured(id: ProviderId): boolean {
  switch (id) {
    case "claude":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "groq":
      return Boolean(process.env.GROQ_API_KEY);
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY);
    case "custom":
      // A self-hosted endpoint may need no API key, so a base URL alone counts.
      return Boolean(process.env.CUSTOM_LLM_BASE_URL || process.env.CUSTOM_LLM_API_KEY);
  }
}

function modelFor(id: ProviderId): string {
  switch (id) {
    case "claude":
      return process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
    case "groq":
      return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    case "gemini":
      return process.env.GEMINI_MODEL || "gemini-2.0-flash";
    case "custom":
      return process.env.CUSTOM_LLM_MODEL || "llama3.1";
  }
}

/** The provider that will be used (explicit LLM_PROVIDER, else first configured, else claude). */
export function selectedProvider(): ProviderId {
  const explicit = normalizeId(process.env.LLM_PROVIDER);
  if (explicit) return explicit;
  for (const id of ORDER) if (isConfigured(id)) return id;
  return "claude"; // sensible default label even when nothing is configured yet
}

/** True when the selected provider has the credentials/URL it needs. */
export function aiEnabled(): boolean {
  return isConfigured(selectedProvider());
}

export function providerInfo(): ProviderInfo {
  const id = selectedProvider();
  return {
    id,
    label: LABELS[id],
    model: modelFor(id),
    configured: isConfigured(id),
    envHint: ENV_HINT[id],
  };
}

// ── Low-level completion. Send a system+user prompt, return the text. ──
export async function complete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const id = selectedProvider();
  if (!isConfigured(id)) {
    throw new Error(
      `LLM provider "${id}" is not configured. Set ${ENV_HINT[id]} in .env (or pick another provider with LLM_PROVIDER).`
    );
  }
  const maxTokens = opts.maxTokens ?? 2048;
  switch (id) {
    case "claude":
      return completeAnthropic(opts, maxTokens);
    case "groq":
      return completeOpenAICompatible(
        {
          baseUrl: "https://api.groq.com/openai/v1",
          apiKey: process.env.GROQ_API_KEY || "",
          model: modelFor("groq"),
          label: "Groq",
        },
        opts,
        maxTokens
      );
    case "custom":
      return completeOpenAICompatible(
        {
          baseUrl: process.env.CUSTOM_LLM_BASE_URL || "http://localhost:11434/v1",
          apiKey: process.env.CUSTOM_LLM_API_KEY || "",
          model: modelFor("custom"),
          label: "Custom LLM",
        },
        opts,
        maxTokens
      );
    case "gemini":
      return completeGemini(opts, maxTokens);
  }
}

// ── Anthropic (Claude) via official SDK ──
let anthropicClient: Anthropic | null = null;
async function completeAnthropic(
  opts: { system: string; user: string },
  maxTokens: number
): Promise<string> {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  const msg = await anthropicClient.messages.create({
    model: modelFor("claude"),
    max_tokens: maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// ── OpenAI-compatible chat completions (Groq, Ollama, LM Studio, vLLM, OpenAI…) ──
async function completeOpenAICompatible(
  cfg: { baseUrl: string; apiKey: string; model: string; label: string },
  opts: { system: string; user: string },
  maxTokens: number
): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const res = await withTimeout((signal) =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    })
  );
  if (!res.ok) {
    throw new Error(`${cfg.label} API error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

// ── Google Gemini via generateContent REST API ──
async function completeGemini(
  opts: { system: string; user: string },
  maxTokens: number
): Promise<string> {
  const key = process.env.GEMINI_API_KEY!;
  const model = modelFor("gemini");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await withTimeout((signal) =>
    fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      }),
    })
  );
  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

// Local LLMs can be slow; give every remote call a generous ceiling.
async function withTimeout(fn: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const ms = Number(process.env.LLM_TIMEOUT_MS || 120000);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(t);
  }
}
