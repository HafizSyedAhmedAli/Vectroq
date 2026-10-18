import nodemailer from "nodemailer";
import { Resend } from "resend";

const from = process.env.EMAIL_FROM ?? "Vectroq <onboarding@resend.dev>";

/** Returns true when really sent, false when only logged (dev without a provider). */
export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  // 1. Gmail / any SMTP server
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from, ...msg });
    return true;
  }

  // 2. Resend (needs a verified domain to reach other people)
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const { error } = await new Resend(key).emails.send({ from, ...msg });
    if (error) throw new Error(error.message);
    return true;
  }

  // 3. Nothing configured
  if (process.env.NODE_ENV === "production")
    throw new Error("No email provider is configured");
  console.log(
    `\n[email:dev] To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`,
  );
  return false;
}
