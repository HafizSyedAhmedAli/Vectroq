import { existsSync } from "node:fs";
import { join } from "node:path";

const here = __dirname;
const all = [
  ["sample-house", join(here, "../fixtures/sample-house.dxf")],
  [
    "whole_house_simple_plan",
    join(here, "../fixtures/whole_house_simple_plan.dxf"),
  ],
  [
    "whole_house_connected",
    join(here, "../fixtures/whole_house_connected.dxf"),
  ],
  [
    "web-sample-house-plan",
    join(here, "../../../apps/web/public/samples/sample-house-plan.dxf"),
  ],
] as const;

export const FIXTURES = all
  .filter(([, p]) => existsSync(p))
  .map(([name, path]) => ({ name, path }));
