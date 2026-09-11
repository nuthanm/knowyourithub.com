import nodemailer from "nodemailer";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

const target = (process.argv[2] || process.env.MAIL_TO || process.env.SMTP_USER || "").trim();
const host = normalize(process.env.SMTP_HOST);
const port = Number(process.env.SMTP_PORT || 587);
const user = normalize(process.env.SMTP_USER);
const pass = normalize(process.env.SMTP_PASS);

if (!host || !user || !pass) {
  console.error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in the project env file.");
  process.exit(1);
}

if (!target) {
  console.error("No recipient provided. Pass an email address as the first argument or set MAIL_TO.");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

const fromAddress = (process.env.MAIL_FROM || '').trim() || `"Know Your IT Hub" <${user}>`;

await transport.sendMail({
  from: fromAddress,
  to: target,
  subject: "Test email from Know Your IT Hub",
  text: "This is a smoke-test email triggered manually from the project mailer.",
  html: "<p>This is a smoke-test email triggered manually from the project mailer.</p>",
});

console.log(`EMAIL_SENT:${target}`);
