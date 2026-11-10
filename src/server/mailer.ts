import "server-only";
import nodemailer from "nodemailer";
import { getSettings } from "./settings";
import { logIntegration } from "./integration-log";

export type Mail = { to: string | string[]; subject: string; text: string; html?: string; replyTo?: string };

/** The SMTP connection from Admin → Integrations, or null when it isn't set up. */
async function smtp() {
  const c = await getSettings(["email.smtpHost", "email.smtpPort", "email.smtpUser", "email.smtpPassword", "email.fromAddress", "email.fromName"]);
  const host = c["email.smtpHost"];
  const from = c["email.fromAddress"] || c["email.smtpUser"];
  if (!host || !from) return null;
  const port = Number(c["email.smtpPort"] || 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: c["email.smtpUser"] ? { user: c["email.smtpUser"], pass: c["email.smtpPassword"] ?? "" } : undefined,
    connectionTimeout: 10_000,
  });
  return { transport, from: { name: c["email.fromName"] || "Span Floors", address: from } };
}

/** Sends email via the SMTP settings in Admin → Integrations. Returns false (and never throws) when not configured or on failure. */
export async function sendMail(mail: Mail, action = "send"): Promise<boolean> {
  const s = await smtp();
  if (!s) return false;
  const subject = mail.subject.replace(/[\r\n]+/g, " ").slice(0, 200);
  try {
    await s.transport.sendMail({ from: s.from, to: mail.to, subject, text: mail.text, html: mail.html, replyTo: mail.replyTo });
    await logIntegration("email", action, true, `Sent “${subject}”`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("sendMail failed:", msg);
    await logIntegration("email", action, false, `“${subject}” failed: ${msg}`);
    return false;
  }
}

/** Checks the SMTP login without sending anything. */
export async function verifySmtp(): Promise<{ ok: boolean; message: string }> {
  const s = await smtp();
  if (!s) return { ok: false, message: "Email isn't set up yet: add the SMTP server and sender address." };
  try {
    await s.transport.verify();
    return { ok: true, message: "The mail server accepted the login." };
  } catch (e) {
    return { ok: false, message: `The mail server refused: ${e instanceof Error ? e.message : e}` };
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
