// apps/web/src/components/CsrImportForm.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CsrImportForm } from "./CsrImportForm";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function mockFetch(ok: boolean, json: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(json) })),
  );
}

const CSV = "city,itemType,unit,unitRate\nKarachi,cement,bag,1400\n";

async function fillAndPick(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/schedule name/i), "Sindh CSR");
  await user.type(screen.getByLabelText(/approved by/i), "Office");
  await user.upload(
    screen.getByLabelText(/csv file/i),
    new File([CSV], "sindh.csv", { type: "text/csv" }),
  );
}

describe("CsrImportForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    refresh.mockClear();
  });

  it("posts the CSV with its metadata, reports the result and refreshes the page", async () => {
    mockFetch(true, { imported: 3, cities: ["Karachi"] });
    render(<CsrImportForm />);
    const user = userEvent.setup();

    await fillAndPick(user);
    await user.click(screen.getByRole("button", { name: /import rates/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /imported 3 rate sets for karachi/i,
    );
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe("/api/rate-sets/import");
    expect(JSON.parse(init.body)).toMatchObject({
      csv: CSV,
      document: "Sindh CSR",
      year: expect.any(Number),
      categories: ["A", "B", "C"],
      approvedBy: "Office",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's reason when the import is rejected", async () => {
    mockFetch(false, { error: "Unknown city name(s): Karahci." });
    render(<CsrImportForm />);
    const user = userEvent.setup();

    await fillAndPick(user);
    await user.click(screen.getByRole("button", { name: /import rates/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/karahci/i);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not call the API without a file", async () => {
    mockFetch(true, {});
    render(<CsrImportForm />);

    await userEvent.click(
      screen.getByRole("button", { name: /import rates/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/choose a csv/i);
    expect(fetch).not.toHaveBeenCalled();
  });
});
