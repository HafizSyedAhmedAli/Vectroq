"use client";

import { useEffect, useState } from "react";
import { Check, CodeXml, Copy, Info } from "lucide-react";

type Kind = "tag" | "attr" | "str" | "kw" | "fn" | "p";
type Tok = [Kind, string];

// One Dark palette, matching the mock.
const COLOR: Record<Kind, string> = {
  tag: "#e06c75",
  attr: "#d19a66",
  str: "#98c379",
  kw: "#c678dd",
  fn: "#61afef",
  p: "#abb2bf",
};

// One attribute per line, indented, so no line runs under the Copy button.
const attrLine = (name: string, value: string): Tok[] => [
  ["p", "  "],
  ["attr", name],
  ["p", "="],
  ["str", `"${value}"`],
];

export function EmbedCode({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  // The same tokens are rendered with colors and joined into the plain
  // text that gets copied.
  const lines: Tok[][] = [
    [["tag", "<iframe"]],
    attrLine("id", "vectroq-form"),
    attrLine("src", `${origin}/embed/${slug}`),
    attrLine("title", "Request a quote"),
    attrLine("loading", "lazy"),
    attrLine("style", "width:100%;border:0;min-height:700px"),
    [["tag", "></iframe>"]],
    [["tag", "<script>"]],
    [
      ["p", "  "],
      ["fn", "window.addEventListener"],
      ["p", "("],
      ["str", '"message"'],
      ["p", ", "],
      ["kw", "function"],
      ["p", " (e) {"],
    ],
    [
      ["p", "    "],
      ["kw", "if"],
      ["p", " (e.origin !== "],
      ["str", `"${origin}"`],
      ["p", " || !e.data || e.data.type !== "],
      ["str", '"vectroq:height"'],
      ["p", ") "],
      ["kw", "return"],
      ["p", ";"],
    ],
    [
      ["p", "    "],
      ["fn", "document.getElementById"],
      ["p", "("],
      ["str", '"vectroq-form"'],
      ["p", ").style.height = e.data.height + "],
      ["str", '"px"'],
      ["p", ";"],
    ],
    [["p", "  });"]],
    [["tag", "</script>"]],
  ];

  const plain = lines.map((l) => l.map((t) => t[1]).join("")).join("\n");

  return (
    <section className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)] sm:p-7">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-50 text-brand">
          <CodeXml className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-brand-black">
            Embed on your website
          </h2>
          <p className="text-sm text-stone-500">
            Paste this into any page. Leads land in your dashboard.
          </p>
        </div>
      </div>

      <div className="relative mt-6 rounded-xl bg-[#232a3b]">
        {/* Solid background: code can never show through the button */}
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(plain);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="absolute right-3 top-3 z-10 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/25 bg-[#2f374b] px-3 text-xs font-semibold text-white hover:bg-[#3a4358]"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy code"}
        </button>

        <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6">
          <code className="block">
            {lines.map((line, i) => (
              <span key={i} className="block whitespace-pre">
                {line.map(([kind, t], j) => (
                  <span key={j} style={{ color: COLOR[kind] }}>
                    {t}
                  </span>
                ))}
              </span>
            ))}
          </code>
        </pre>
      </div>

      <p className="mt-4 flex items-center gap-3 rounded-xl bg-brand/10 px-4 py-3.5 text-xs text-stone-600">
        <Info className="size-4 shrink-0 text-brand" />
        Make sure to replace the URL with your actual form link if it changes.
      </p>
    </section>
  );
}
