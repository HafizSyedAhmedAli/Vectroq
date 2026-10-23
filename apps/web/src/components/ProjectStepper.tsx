import { Check } from "lucide-react";

export function ProjectStepper({
  hasCad,
  hasBoq,
}: {
  hasCad: boolean;
  hasBoq: boolean;
}) {
  const steps = [
    { label: "Project created", done: true },
    { label: "Upload drawing", done: hasCad },
    { label: "3D model", done: hasCad },
    { label: "Review & price BOQ", done: hasBoq },
    { label: "Present to client", done: hasBoq },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="print:hidden mb-6 flex flex-wrap gap-2">
      {steps.map((s, i) => {
        const state = s.done ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={s.label}
            aria-current={state === "current" ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${
              state === "done"
                ? "border-brand/20 bg-brand/10 text-brand"
                : state === "current"
                  ? "border-brand bg-brand text-white shadow-md shadow-brand/25"
                  : "border-stone-200 bg-white text-stone-400"
            }`}
          >
            {state === "done" ? (
              <span className="grid size-4 place-items-center rounded-full bg-brand text-white">
                <Check className="size-3" />
              </span>
            ) : (
              <span>{i + 1}.</span>
            )}
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
