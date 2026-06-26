import nodemailer from "nodemailer";

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

// Send an email via SMTP (e.g. Gmail app password). Used only when the user
// approves a draft (review mode) or when emailMode is "auto".
export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
}): Promise<SendResult> {
  if (!smtpConfigured()) {
    return { ok: false, error: "SMTP is not configured. Add SMTP_USER and SMTP_PASSWORD to .env." };
  }
  if (!opts.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(opts.to)) {
    return { ok: false, error: "Recipient email is missing or invalid." };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });

  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const from = opts.fromName ? `"${opts.fromName}" <${fromAddr}>` : fromAddr;

  try {
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.body,
      html: opts.body.replace(/\n/g, "<br/>"),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Guess a recruiter email from a name + company domain when none is provided.
// Best-effort convenience only — always review before sending.
export function guessRecruiterEmail(name: string, companyDomain: string): string {
  const parts = name.trim().toLowerCase().split(/\s+/);
  if (!companyDomain || parts.length < 1) return "";
  const domain = companyDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (parts.length === 1) return `${parts[0]}@${domain}`;
  return `${parts[0]}.${parts[parts.length - 1]}@${domain}`;
}
