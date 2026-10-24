// Shared dark-mode classes for the auth pages. The `!` suffix is needed on the
// shadcn <Input>, whose own dark:bg-input/30 would otherwise win.
export const darkLabel = "dark:text-slate-200";

export const darkInput =
  "dark:border-white/15! dark:bg-white/5! dark:text-white! dark:placeholder:text-slate-500 dark:focus-visible:border-blue-400! dark:focus-visible:ring-blue-400/20";

export const darkAlert =
  "dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300";

export const darkLink = "dark:text-blue-400 dark:hover:text-blue-300";
