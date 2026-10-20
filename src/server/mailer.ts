import "server-only";
import nodemailer from "nodemailer";
import { getSettings } from "./settings";

export type Mail = { to: string | string[]; subject: string; text: string; html?: string; replyTo?: string };

/** Sends email via the SMTP settings in Admin → Integrations. Returns false (and never throws) when not configured or on failure. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const c = await getSettings(["email.smtpHost", "email.smtpPort", "email.smtpUser", "email.smtpPassword", "email.fromAddress", "email.fromName"]);
  const host = c["email.smtpHost"];
  const from = c["email.fromAddress"] || c["email.smtpUser"];
  if (!host || !from) return false;
  try {
    const port = Number(c["email.smtpPort"] || 587);
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: c["email.smtpUser"] ? { user: c["email.smtpUser"], pass: c["email.smtpPassword"] ?? "" } : undefined,
      connectionTimeout: 10_000,
    });
    await transport.sendMail({
      from: { name: c["email.fromName"] || "Span Floors", address: from },
      to: mail.to,
      subject: mail.subject.replace(/[\r\n]+/g, " ").slice(0, 200),
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo,
    });
    return true;
  } catch (e) {
    console.error("sendMail failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
