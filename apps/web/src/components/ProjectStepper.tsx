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
    <ol className="print:hidden flex flex-wrap gap-2 mb-8">
      {steps.map((s, i) => {
        const state = s.done ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={s.label}
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border ${
              state === "done"
                ? "bg-green-50 border-green-200 text-green-700"
                : state === "current"
                  ? "bg-brand text-white border-brand"
                  : "bg-white border-stone-200 text-stone-400"
            }`}
          >
            <span>{state === "done" ? "✓" : i + 1}</span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
