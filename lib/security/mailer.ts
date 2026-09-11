import nodemailer from "nodemailer";

type SendInput = { to: string; subject: string; text: string; html: string };

const SITE_FROM_NAME = "Know Your IT Hub";

function normalize(value?: string) {
  return (value ?? "").trim().replace(/\s+/g, "");
}

function formatFromAddress() {
  const configuredFrom = (process.env.MAIL_FROM || "").trim();
  if (configuredFrom) return configuredFrom;
  const user = normalize(process.env.SMTP_USER);
  if (!user) return SITE_FROM_NAME;
  return `"${SITE_FROM_NAME}" <${user}>`;
}

function isPlaceholder(value?: string) {
  const n = normalize(value).toLowerCase();
  return !n || n.includes("replace") || n === "smtp.example.com" || n.includes("your@gmail.com");
}

function getTransport() {
  const host = normalize(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 587);
  const user = normalize(process.env.SMTP_USER);
  const pass = normalize(process.env.SMTP_PASS);
  if (isPlaceholder(host) || isPlaceholder(user) || isPlaceholder(pass)) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

export function isMailerConfigured() {
  return !isPlaceholder(process.env.SMTP_HOST)
    && !isPlaceholder(process.env.SMTP_USER)
    && !isPlaceholder(process.env.SMTP_PASS);
}

export async function sendMail(input: SendInput) {
  const transport = getTransport();
  if (!transport) {
    throw new Error("Mailer not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS (Gmail App Password works).");
  }
  await transport.sendMail({
    from: formatFromAddress(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
