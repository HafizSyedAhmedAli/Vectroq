"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export function EmbedCode({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const code = `<iframe id="vectroq-form" src="${origin}/embed/${slug}" title="Request a quote" loading="lazy" style="width:100%;border:0;min-height:700px"></iframe>
<script>
window.addEventListener("message", function (e) {
  if (e.origin !== "${origin}" || !e.data || e.data.type !== "vectroq:height") return;
  document.getElementById("vectroq-form").style.height = e.data.height + "px";
});
</script>`;

  return (
    <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-brand-black">
        Embed on your website
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        Paste this into any page. Leads land in your dashboard.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-stone-900 p-4 text-xs text-stone-100">
        {code}
      </pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy code"}
      </button>
    </section>
  );
}
