/**
 * Recursive baseline comparison with a numeric tolerance.
 *
 * Numeric leaves may differ by at most `tol` (default 1e-9 ft, nine orders below
 * anything the parser distinguishes). Everything else must match exactly: types,
 * object keys, array lengths and order, strings, booleans, nulls and ids. The
 * actual geometry is never rounded; only the comparison is tolerant.
 *
 * Returns null when equal, otherwise a description of the first mismatch.
 */
export const BASELINE_TOLERANCE = 1e-9;

export function firstMismatch(
  actual: unknown,
  expected: unknown,
  tol: number = BASELINE_TOLERANCE,
  path = "$",
): string | null {
  if (typeof expected === "number" && typeof actual === "number") {
    // NaN and Infinity never compare close
    return Math.abs(actual - expected) <= tol
      ? null
      : `${path}: ${actual} differs from ${expected} by more than ${tol}`;
  }
  if (typeof actual !== typeof expected)
    return `${path}: type ${typeof actual} vs ${typeof expected}`;
  if (actual === null || expected === null)
    return actual === expected ? null : `${path}: null mismatch`;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${path}: expected an array`;
    if (actual.length !== expected.length)
      return `${path}: array length ${actual.length} vs ${expected.length}`;
    for (let i = 0; i < expected.length; i++) {
      const m = firstMismatch(actual[i], expected[i], tol, `${path}[${i}]`);
      if (m) return m;
    }
    return null;
  }
  if (typeof expected === "object") {
    if (Array.isArray(actual)) return `${path}: expected an object`;
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    const ak = Object.keys(a).sort();
    const ek = Object.keys(e).sort();
    if (ak.join("\u0000") !== ek.join("\u0000"))
      return `${path}: keys [${ak.join(",")}] vs [${ek.join(",")}]`;
    for (const k of ek) {
      const m = firstMismatch(a[k], e[k], tol, `${path}.${k}`);
      if (m) return m;
    }
    return null;
  }
  return actual === expected
    ? null
    : `${path}: ${String(actual)} vs ${String(expected)}`;
}
