import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));
const resendSend = vi.fn();
const resendCtor = vi.fn();
vi.mock("nodemailer", () => ({ default: { createTransport: (o: unknown) => (createTransport as (o: unknown) => unknown)(o) } }));
vi.mock("resend", () => ({
  Resend: class { emails = { send: (m: unknown) => resendSend(m) }; constructor(k: string) { resendCtor(k); } },
}));

const msg = { to: "a@b.c", subject: "S", html: "<p>h</p>", text: "t" };
const OLD = { ...process.env };

async function load() { vi.resetModules(); return (await import("./email")).sendEmail; }

beforeEach(() => {
  sendMail.mockReset(); createTransport.mockClear(); resendSend.mockReset(); resendCtor.mockClear();
  for (const k of ["SMTP_USER", "SMTP_PASS", "SMTP_HOST", "SMTP_PORT", "RESEND_API_KEY", "EMAIL_FROM"]) delete process.env[k];
});
afterEach(() => { process.env = { ...OLD }; vi.restoreAllMocks(); });

describe("sendEmail", () => {
  it("uses SMTP when SMTP_USER and SMTP_PASS are set", async () => {
    process.env.SMTP_USER = "u"; process.env.SMTP_PASS = "p";
    sendMail.mockResolvedValue({});
    const send = await load();
    await expect(send(msg)).resolves.toBe(true);
    expect(createTransport).toHaveBeenCalledWith({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "u", pass: "p" } });
    expect(sendMail).toHaveBeenCalledWith({ from: "Vectroq <onboarding@resend.dev>", ...msg });
  });

  it("honours SMTP_HOST, SMTP_PORT and EMAIL_FROM", async () => {
    Object.assign(process.env, { SMTP_USER: "u", SMTP_PASS: "p", SMTP_HOST: "mail.x", SMTP_PORT: "587", EMAIL_FROM: "Me <m@x>" });
    sendMail.mockResolvedValue({});
    await (await load())(msg);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "mail.x", port: 587 }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "Me <m@x>" }));
  });

  it("prefers SMTP over Resend", async () => {
    Object.assign(process.env, { SMTP_USER: "u", SMTP_PASS: "p", RESEND_API_KEY: "k" });
    sendMail.mockResolvedValue({});
    await (await load())(msg);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("uses Resend when only the API key is set", async () => {
    process.env.RESEND_API_KEY = "re_1";
    resendSend.mockResolvedValue({ error: null });
    await expect((await load())(msg)).resolves.toBe(true);
    expect(resendCtor).toHaveBeenCalledWith("re_1");
    expect(resendSend).toHaveBeenCalledWith({ from: "Vectroq <onboarding@resend.dev>", ...msg });
  });

  it("throws the Resend error message", async () => {
    process.env.RESEND_API_KEY = "re_1";
    resendSend.mockResolvedValue({ error: { message: "bad domain" } });
    await expect((await load())(msg)).rejects.toThrow("bad domain");
  });

  it("logs and returns false with no provider outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect((await load())(msg)).resolves.toBe(false);
    expect(log.mock.calls[0][0]).toContain("a@b.c");
    vi.unstubAllEnvs();
  });

  it("throws with no provider in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect((await load())(msg)).rejects.toThrow("No email provider is configured");
    vi.unstubAllEnvs();
  });
});
