import nodemailer from "nodemailer";
import { schema, uuidv7, type Db } from "@mfg/db";
import { directionOf, isLocale, translate, type AppLocale } from "@mfg/i18n";
import type { EmailMessage, EmailSender } from "../../ports";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Render a notification template from the `notifications` catalog in the recipient's language. */
export function renderEmail(template: string, locale: string, vars: Record<string, string | number>): Omit<EmailMessage, "to"> {
  const loc: AppLocale = isLocale(locale) ? locale : "he";
  const subject = translate(loc, `notifications.${template}.subject`, vars);
  const body = translate(loc, `notifications.${template}.body`, vars);
  const footer = translate(loc, "notifications.footer");
  const brand = translate(loc, "notifications.brand");
  const text = `${body}\n\n— ${brand}\n${footer}`;
  const dir = directionOf(loc);
  const linked = escapeHtml(body).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  const html = `<!doctype html><html lang="${loc}" dir="${dir}"><body style="font-family:'IBM Plex Sans','IBM Plex Sans Hebrew',Arial,sans-serif;background:#F8F9FA;color:#111418;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #E6E9ED;border-radius:10px;padding:24px"><p style="font-weight:600;margin:0 0 16px">${escapeHtml(brand)}</p><p style="line-height:1.6;margin:0 0 24px">${linked}</p><p style="color:#6B7480;font-size:12px;margin:0">${escapeHtml(footer)}</p></div></body></html>`;
  return { subject, text, html, template, locale: loc };
}

/** Development/CI sender: records messages in `email_messages` (the dev mailbox). */
export class LogEmailSender implements EmailSender {
  constructor(private readonly db: Db) {}
  async send(m: EmailMessage): Promise<void> {
    await this.db.insert(schema.emailMessages).values({ id: uuidv7(), toAddress: m.to, ...m, status: "logged" });
  }
}

export class SmtpEmailSender implements EmailSender {
  private transport;
  constructor(
    smtpUrl: string,
    private readonly from: string,
    private readonly db: Db,
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }
  async send(m: EmailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, text: m.text, html: m.html });
    await this.db.insert(schema.emailMessages).values({ id: uuidv7(), toAddress: m.to, ...m, status: "sent" });
  }
}

/** In-memory sender for unit tests. */
export class MemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  async send(m: EmailMessage): Promise<void> {
    this.sent.push(m);
  }
}
