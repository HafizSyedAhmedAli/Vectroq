import type {
  ParseMeta,
  ParseSeverity,
  ParseUnitInfo,
  ParseWarning,
} from "@vectroq/shared-types";

/**
 * Bump when parsing behaviour changes. Nothing compares this string; it is only
 * recorded in ParseMeta.
 * 0.0.0-phase0  : Phase 0 (no behaviour change).
 * 0.2.0-stage3a : Phase 2 Mode A shared-wall merge (Stage 2) and Mode B
 *                 overlapping-wall-line merge (Stage 3a).
 */
export const PARSER_VERSION = "0.2.0-stage3a";

type EntityRef = ParseWarning["entity"];

/** Collects warnings and counters during one parse. */
export class ParseReport {
  private warnings: ParseWarning[] = [];
  private stats: Record<string, number> = {};

  add(
    severity: ParseSeverity,
    code: string,
    message: string,
    entity?: EntityRef,
  ) {
    this.warnings.push({
      code,
      severity,
      message,
      ...(entity ? { entity } : {}),
    });
  }
  info(code: string, message: string, entity?: EntityRef) {
    this.add("info", code, message, entity);
  }
  warning(code: string, message: string, entity?: EntityRef) {
    this.add("warning", code, message, entity);
  }
  error(code: string, message: string, entity?: EntityRef) {
    this.add("error", code, message, entity);
  }
  stat(key: string, value: number) {
    this.stats[key] = value;
  }
  hasErrors(): boolean {
    return this.warnings.some((w) => w.severity === "error");
  }
  toMeta(unit: ParseUnitInfo, extra: { rotationRad?: number } = {}): ParseMeta {
    return {
      parserVersion: PARSER_VERSION,
      unit: { ...unit },
      ...(extra.rotationRad !== undefined
        ? { rotationRad: extra.rotationRad }
        : {}),
      warnings: this.warnings.map((w) => ({ ...w })),
      stats: { ...this.stats },
    };
  }
}

export const hasErrors = (meta: Pick<ParseMeta, "warnings">): boolean =>
  meta.warnings.some((w) => w.severity === "error");
