"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SRC}"]`,
    );
    const s =
      existing ??
      Object.assign(document.createElement("script"), {
        src: SRC,
        async: true,
      });
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile")));
    if (!existing) document.head.appendChild(s);
  });
}

/**
 * Centered under the form. Once Cloudflare has issued a token the widget is
 * hidden (not unmounted, so the token stays valid). If the token expires or
 * errors, it reappears so the visitor can verify again.
 */
export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let id: string | undefined;
    let cancelled = false;
    const report = (token: string) => {
      setVerified(token !== "");
      onToken(token);
    };
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: report,
          "expired-callback": () => report(""),
          "error-callback": () => report(""),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, onToken]);

  return (
    <div
      className={verified ? "hidden" : "mt-6 flex justify-center"}
      aria-live="polite"
    >
      <div ref={ref} />
    </div>
  );
}
