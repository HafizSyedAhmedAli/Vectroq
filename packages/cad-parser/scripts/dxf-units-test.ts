import { readFileSync } from "node:fs";
import { parseDxf } from "../src/parse-dxf";

const text = readFileSync("fixtures/whole_house_connected.dxf", "utf8");
const a = parseDxf(text);
console.log(
  a.meta.unit.needsConfirmation,
  a.meta.unit.candidates,
  a.meta.warnings,
);

const b = parseDxf(text, { confirmedUnit: "millimetre" });
console.log(b.meta.unit);
