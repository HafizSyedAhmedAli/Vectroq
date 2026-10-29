import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BOQResult } from "@vectroq/shared-types";
import { BoqTable } from "./BoqTable";

const li = (
  itemType: string,
  quantity: number,
  unit: string,
  unitRate: number,
) => ({
  itemType: itemType as never,
  quantity,
  unit,
  unitRate,
  subtotal: quantity * unitRate,
});
const boq = (over: Partial<BOQResult> = {}): BOQResult => ({
  lineItems: [
    li("foundation", 1000, "sqft", 100),
    li("masonry", 900, "sqft", 120),
    li("cement", 300, "bag", 1300),
  ],
  subtotal: 598000,
  tax: 59800,
  total: 657800,
  ...over,
});

describe("BoqTable", () => {
  it("renders the column headers", () => {
    render(<BoqTable boq={boq()} />);
    for (const h of ["Item", "Quantity", "Rate (Rs)", "Amount (Rs)"])
      expect(screen.getByText(h)).toBeInTheDocument();
  });

  it("groups items and shows a subtotal for each non-empty group only", () => {
    render(<BoqTable boq={boq()} />);
    for (const g of ["Structure", "Masonry & Plaster", "Materials"]) {
      expect(screen.getByText(g)).toBeInTheDocument();
      expect(screen.getByText(`${g} subtotal`)).toBeInTheDocument();
    }
    expect(screen.queryByText("Finishes subtotal")).not.toBeInTheDocument();
  });

  it("shows readable item names and formatted quantities", () => {
    render(<BoqTable boq={boq()} />);
    expect(
      screen.getByText("Foundation, excavation & plinth"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cement (50 kg bags)")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  it("falls back to the raw type for an unknown item", () => {
    render(<BoqTable boq={boq({ lineItems: [li("mystery", 1, "zz", 5)] })} />);
    expect(screen.getByText("mystery")).toBeInTheDocument();
  });

  it("shows subtotal, tax with its percentage and the total", () => {
    render(<BoqTable boq={boq()} />);
    expect(screen.getByText("Rs 598,000")).toBeInTheDocument();
    expect(screen.getByText("Sales tax (10%)")).toBeInTheDocument();
    expect(screen.getByText("Rs 59,800")).toBeInTheDocument();
    expect(screen.getByText("Total estimated cost")).toBeInTheDocument();
    expect(screen.getByText("Rs 657,800")).toBeInTheDocument();
  });

  it("shows 0% tax for an empty BOQ", () => {
    render(<BoqTable boq={{ lineItems: [], subtotal: 0, tax: 0, total: 0 }} />);
    expect(screen.getByText("Sales tax (0%)")).toBeInTheDocument();
  });

  it("states the rate source, plainly when it's the project's own city", () => {
    render(
      <BoqTable
        boq={boq({
          rateBasis: {
            label: "Regional CSR 2026",
            place: "Karachi",
            requestedCity: "Karachi",
            isFallback: false,
            origin: "csr",
          },
        })}
      />,
    );
    const p = screen.getByText("Rates: Regional CSR 2026 (Karachi)");
    expect(p.className).toContain("text-stone-500");
  });

  it("highlights when another market's rates were used", () => {
    render(
      <BoqTable
        boq={boq({
          rateBasis: {
            label: "Regional CSR 2026",
            place: "Hyderabad",
            requestedCity: "Nawabshah",
            isFallback: true,
            origin: "csr",
          },
        })}
      />,
    );
    const p = screen.getByText(
      /using Hyderabad rates \(no rates loaded for Nawabshah\)/,
    );
    expect(p.className).toContain("text-amber-700");
  });

  it("shows no rate line for older BOQs", () => {
    render(<BoqTable boq={boq()} />);
    expect(screen.queryByText(/^Rates:/)).not.toBeInTheDocument();
  });
});
