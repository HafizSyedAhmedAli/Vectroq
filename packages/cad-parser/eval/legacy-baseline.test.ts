import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseDxfToGeometry } from "../src/parse-dxf";
import { FIXTURES } from "./fixtures";

// Capture:  UPDATE_BASELINES=1  (see instructions). Baselines are committed and never edited by hand.
const dir = join(__dirname, "../baselines/legacy");
const update = process.env.UPDATE_BASELINES === "1";

const current = (path: string) =>
  JSON.parse(JSON.stringify(parseDxfToGeometry(readFileSync(path, "utf8"))));

describe("legacy parser baselines", () => {
  for (const f of FIXTURES) {
    const file = join(dir, `${f.name}.json`);
    if (update) {
      it(`captures ${f.name}`, () => {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, JSON.stringify(current(f.path), null, 2) + "\n");
      });
    } else {
      if (!existsSync(file))
        console.warn(`No legacy baseline for ${f.name}; run the capture step.`);
      it.skipIf(!existsSync(file))(
        `${f.name} still matches its legacy baseline`,
        () => {
          expect(current(f.path)).toEqual(
            JSON.parse(readFileSync(file, "utf8")),
          );
        },
      );
    }
  }
});
