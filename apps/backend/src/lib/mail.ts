/**
 * Transactional SMTP (e.g. GoDaddy [Titan Email](https://secureserver.titan.email/) — outbound host is typically smtp.titan.email).
 * Does not log credentials, passwords, or verification URLs.
 */

import nodemailer from "nodemailer";

const DEFAULT_SMTP_HOST = "smtp.titan.email";
const DEFAULT_MAIL_FROM = "Viper AI <info@viperai.tech>";
const DEFAULT_SMTP_USER = "info@viperai.tech";

export function isSmtpConfigured(): boolean {
  const pass = process.env["VIPER_SMTP_PASS"] ?? process.env["VIPER_SMTP_PASSWORD"];
  return typeof pass === "string" && pass.length > 0;
}

function smtpSecureForPort(port: number): boolean {
  const v = process.env["VIPER_SMTP_SECURE"];
  if (v === "1" || v?.toLowerCase() === "true") return true;
  if (v === "0" || v?.toLowerCase() === "false") return false;
  return port === 465;
}

function escapeHtmlAttr(url: string): string {
  return url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export async function sendVerificationEmail(params: {
  to: string;
  verifyUrl: string;
}): Promise<{ ok: true } | { ok: false; reason: "not_configured" | "send_failed" }> {
  const pass = process.env["VIPER_SMTP_PASS"] ?? process.env["VIPER_SMTP_PASSWORD"];
  if (!pass) {
    return { ok: false, reason: "not_configured" };
  }

  const host = process.env["VIPER_SMTP_HOST"]?.trim() || DEFAULT_SMTP_HOST;
  const port = Number.parseInt(process.env["VIPER_SMTP_PORT"] || "465", 10);
  const secure = smtpSecureForPort(port);
  const user = process.env["VIPER_SMTP_USER"]?.trim() || DEFAULT_SMTP_USER;
  const from = process.env["VIPER_MAIL_FROM"]?.trim() || DEFAULT_MAIL_FROM;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const { to, verifyUrl } = params;
  const href = escapeHtmlAttr(verifyUrl);

  try {
    await transporter.sendMail({
      from,
      to,
      subject: "Verify your email for Viper AI",
      text: [
        "Thanks for signing up for Viper AI.",
        "",
        "Use this one-time link to verify your email (valid 24 hours):",
        verifyUrl,
        "",
        "If you did not create an account, you can ignore this message.",
      ].join("\n"),
      html: `<p>Thanks for signing up for Viper AI.</p>
<p><a href="${href}">Verify your email</a> — this link is single-use and expires in 24 hours.</p>
<p style="color:#666;font-size:14px">If you did not create an account, you can ignore this email.</p>`,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "send_failed" };
  }
}
