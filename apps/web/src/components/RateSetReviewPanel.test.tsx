import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApprovedRateSet, DraftRateSet } from "@/lib/rate-set-types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./CsrImportForm", () => ({
  CsrImportForm: () => <div>csr-form</div>,
}));
vi.mock("./ManualRateForm", () => ({
  ManualRateForm: () => <div>manual-form</div>,
}));

import { RateSetReviewPanel } from "./RateSetReviewPanel";

const fetchMock = vi.fn();
const res = (body: unknown = {}, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });

const items = (cement = 1400) => [
  { itemType: "brick" as const, unit: "1000nos" as const, unitRate: 20000 },
  { itemType: "cement" as const, unit: "bag" as const, unitRate: cement },
  { itemType: "sand" as const, unit: "cft" as const, unitRate: 60 },
  {
    itemType: "steelMaterial" as const,
    unit: "ton" as const,
    unitRate: 260000,
  },
];

const approvedSet = (
  id: string,
  city: string,
  category = "B",
  over: Partial<ApprovedRateSet> = {},
): ApprovedRateSet => ({
  id,
  city,
  category,
  origin: "csr",
  approvedBy: "Ali",
  approvedLabel: "1 Oct 2026",
  approvedAt: "2026-10-01T00:00:00.000Z",
  items: items(),
  sources: { document: "Regional CSR", year: 2026 },
  ...over,
});

const draft: DraftRateSet = {
  id: "d1",
  city: "Karachi",
  category: "B",
  origin: "manual",
  createdAt: "2026-10-02T00:00:00.000Z",
  createdLabel: "2 Oct 2026",
  items: items(),
  sources: null,
};

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const detailButtons = () =>
  screen.queryAllByRole("button", { name: /view details/i });

describe("RateSetReviewPanel: approved rates", () => {
  const approved = [
    approvedSet("a1", "Karachi", "A"),
    approvedSet("a2", "Karachi", "B"),
    approvedSet("a3", "Lahore", "B", { isDefault: true }),
  ];

  it("lists every approved set, flags defaults, and renders the sub-forms", () => {
    render(<RateSetReviewPanel initialDrafts={[]} approved={approved} />);
    expect(detailButtons()).toHaveLength(3);
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("csr-form")).toBeInTheDocument();
    expect(screen.getByText("manual-form")).toBeInTheDocument();
  });

  it("filters by city and category, and resets", async () => {
    render(<RateSetReviewPanel initialDrafts={[]} approved={approved} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("City"), "Karachi");
    expect(detailButtons()).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText("Category"), "A");
    expect(detailButtons()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(detailButtons()).toHaveLength(3);
  });

  it("applies the initial city filter", () => {
    render(
      <RateSetReviewPanel
        initialDrafts={[]}
        approved={approved}
        initialCity="Lahore"
      />,
    );
    expect(detailButtons()).toHaveLength(1);
  });

  it("shows an empty message when nothing matches", async () => {
    render(<RateSetReviewPanel initialDrafts={[]} approved={approved} />);
    await userEvent
      .setup()
      .selectOptions(screen.getByLabelText("City"), "Quetta");
    expect(screen.getByText(/no approved rates match/i)).toBeInTheDocument();
  });

  it("expands a row to show each rate and its source", async () => {
    render(
      <RateSetReviewPanel
        initialDrafts={[]}
        approved={[approvedSet("a1", "Karachi")]}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /view details/i }));
    expect(screen.getByText("Cement (50 kg bags)")).toBeInTheDocument();
    expect(screen.getAllByText("Regional CSR 2026").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /hide details/i }));
    expect(screen.queryByText("Cement (50 kg bags)")).not.toBeInTheDocument();
  });

  it("pages in blocks of 10", async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      approvedSet(`a${i}`, `City${i}`),
    );
    render(<RateSetReviewPanel initialDrafts={[]} approved={many} />);
    expect(detailButtons()).toHaveLength(10);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /show more \(2 left\)/i }));
    expect(detailButtons()).toHaveLength(12);
  });
});

describe("RateSetReviewPanel: drafts", () => {
  it("shows the draft count and empty state", () => {
    const { rerender } = render(
      <RateSetReviewPanel initialDrafts={[draft]} approved={[]} />,
    );
    expect(
      screen.getByText("Drafts awaiting review").nextElementSibling,
    ).toHaveTextContent("1");
    rerender(<RateSetReviewPanel initialDrafts={[]} approved={[]} />);
    expect(screen.getByText(/no drafts awaiting review/i)).toBeInTheDocument();
  });

  it("refuses to approve without an approver name", async () => {
    render(<RateSetReviewPanel initialDrafts={[draft]} approved={[]} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/enter your name/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("approves with the edited rate and removes the draft", async () => {
    fetchMock.mockReturnValue(res({ id: "d1" }));
    render(<RateSetReviewPanel initialDrafts={[draft]} approved={[]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Approved By"), "Sara");
    const cement = screen.getByLabelText("Cement (50 kg bags) rate");
    await user.clear(cement);
    await user.type(cement, "1500");
    await user.click(screen.getByRole("button", { name: "Approve" }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rate-sets/d1/approve");
    const sent = JSON.parse(init.body);
    expect(sent.approvedBy).toBe("Sara");
    expect(sent.items.find((i: any) => i.itemType === "cement").unitRate).toBe(
      1500,
    );
    expect(sent.items.find((i: any) => i.itemType === "brick").unitRate).toBe(
      20000,
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Approved Karachi · Category B",
    );
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's error and keeps the draft", async () => {
    fetchMock.mockReturnValue(
      res({ error: "Only DRAFT rate sets can be approved" }, 409),
    );
    render(<RateSetReviewPanel initialDrafts={[draft]} approved={[]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Approved By"), "Sara");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/only draft/i);
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("rejects a draft", async () => {
    fetchMock.mockReturnValue(res({ id: "d1", status: "REJECTED" }));
    render(<RateSetReviewPanel initialDrafts={[draft]} approved={[]} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reject" }));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/rate-sets/d1/reject");
    expect(
      await screen.findByText(/no drafts awaiting review/i),
    ).toBeInTheDocument();
  });

  it("shows warnings attached to a draft", () => {
    render(
      <RateSetReviewPanel
        initialDrafts={[
          { ...draft, sources: { warnings: ["Sand looks low"] } },
        ]}
        approved={[]}
      />,
    );
    expect(screen.getByText("Sand looks low")).toBeInTheDocument();
  });
});
