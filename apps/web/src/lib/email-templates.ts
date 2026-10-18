import { ROLE_LABEL, type Role } from "@/lib/auth/roles";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function layout(title: string, body: string, cta: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;padding:32px">
  <p style="font-size:20px;font-weight:800;margin:0 0 16px">Vectroq</p>
  <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
  <div style="font-size:15px;line-height:1.6;color:#334155">${body}</div>
  <p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>
  <p style="font-size:12px;color:#64748b;word-break:break-all">Or paste this link into your browser:<br>${esc(cta.url)}</p>
</div></body></html>`;
}

export function resetEmail(link: string) {
  return {
    subject: "Reset your Vectroq password",
    html: layout(
      "Reset your password",
      "<p>We received a request to reset your password. This link works once and expires in 1 hour.</p><p>If you didn't ask for this, ignore this email. Your password stays the same.</p>",
      { label: "Reset password", url: link },
    ),
    text: `Reset your Vectroq password (link works once, expires in 1 hour):\n${link}\n\nIf you didn't request this, ignore this email.`,
  };
}

export function inviteEmail(p: {
  orgName: string;
  inviterName: string;
  role: Role;
  link: string;
}) {
  return {
    subject: `${p.inviterName} invited you to ${p.orgName} on Vectroq`,
    html: layout(
      `Join ${p.orgName}`,
      `<p>${esc(p.inviterName)} invited you to join <b>${esc(p.orgName)}</b> as ${esc(ROLE_LABEL[p.role])}. The link is valid for 7 days.</p>`,
      { label: "Accept invitation", url: p.link },
    ),
    text: `${p.inviterName} invited you to join ${p.orgName} on Vectroq as ${ROLE_LABEL[p.role]}.\nAccept (valid 7 days): ${p.link}`,
  };
}