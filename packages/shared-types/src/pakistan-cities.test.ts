import { describe, it, expect } from "vitest";
import {
  CITY_NAMES,
  canonicalCityName,
  citiesByProvince,
  searchPlacesFor,
} from "./pakistan-cities";

describe("pakistan cities", () => {
  it("has no duplicate names", () => {
    expect(new Set(CITY_NAMES).size).toBe(CITY_NAMES.length);
  });

  it("resolves aliases and casing to the canonical name", () => {
    expect(canonicalCityName("benazirabad")).toBe("Nawabshah");
    expect(canonicalCityName("  D.I. Khan ")).toBe("Dera Ismail Khan");
    expect(canonicalCityName("Atlantis")).toBeUndefined();
  });

  it("groups every city under a province", () => {
    const total = citiesByProvince().reduce((n, g) => n + g.cities.length, 0);
    expect(total).toBe(CITY_NAMES.length);
  });

  it("searches the city, then nearby markets, then Pakistan-wide", () => {
    const places = searchPlacesFor("Nawabshah");
    expect(places[0]).toContain("Nawabshah");
    expect(places[0]).toContain("Benazirabad");
    expect(places).toContain("Hyderabad, Sindh");
    expect(places.at(-1)).toBe("Pakistan (national average)");
  });

  it("still gives an unknown place a Pakistan-wide fallback", () => {
    expect(searchPlacesFor("Newtown")).toEqual([
      "Newtown, Pakistan",
      "Pakistan (national average)",
    ]);
  });

  it("lists cities A to Z", () => {
    expect([...CITY_NAMES]).toEqual(
      [...CITY_NAMES].sort((a, b) => a.localeCompare(b, "en")),
    );
    expect(CITY_NAMES[0]).toBe("Abbottabad");
  });
});
