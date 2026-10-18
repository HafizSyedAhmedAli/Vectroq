import { Resend } from "resend";

const from = process.env.EMAIL_FROM ?? "Vectroq <onboarding@resend.dev>";

/** Returns true when really sent, false when only logged (dev without a key). */
export async function sendEmail(msg: {
    to: string;
    subject: string;
    html: string;
    text: string;
}): Promise<boolean> {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        if (process.env.NODE_ENV === "production")
            throw new Error("RESEND_API_KEY is not set");
        console.log(`\n[email:dev] To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`);
        return false;
    }
    const { error } = await new Resend(key).emails.send({ from, ...msg });
    if (error) throw new Error(error.message);
    return true;
}