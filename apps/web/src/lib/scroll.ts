// Scrolls an element into view, animating only when the user has not asked for
// reduced motion. An explicit `behavior: "smooth"` ignores the CSS media query,
// so callers must go through this helper instead of passing it directly.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function scrollToId(
  id: string,
  block: ScrollLogicalPosition = "start",
): void {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView?.({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block,
  });
}
