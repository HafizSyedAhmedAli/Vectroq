import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_ORG_RULES, buildAssumptions } from "@vectroq/shared-types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RulesForm } from "./RulesForm";

const fetchMock = vi.fn();
const res = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const save = () => screen.getByRole("button", { name: /save rules/i });
const body = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("RulesForm", () => {
  it("renders the stored values", () => {
    render(<RulesForm initial={DEFAULT_ORG_RULES} />);
    expect(screen.getByLabelText("Service type 1 name")).toHaveValue(
      DEFAULT_ORG_RULES.models[1].label,
    );
    expect(screen.getByLabelText("Category A name")).toHaveValue("Premium");
    expect(document.querySelector<HTMLInputElement>("#m1-tax")).toHaveValue(15);
    expect(document.querySelector<HTMLInputElement>("#l-masonry")).toHaveValue(
      50,
    );
  });

  it("saves edited text and numbers, sending blank notes as null", async () => {
    fetchMock.mockReturnValue(res({ rules: DEFAULT_ORG_RULES }));
    render(<RulesForm initial={DEFAULT_ORG_RULES} />);
    const user = userEvent.setup();

    const name = screen.getByLabelText("Service type 2 name");
    await user.clear(name);
    await user.type(name, "Turnkey");

    const tax = document.querySelector<HTMLInputElement>("#m2-tax")!;
    await user.clear(tax);
    await user.type(tax, "8");

    await user.click(save());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/org/rules");
    expect(init.method).toBe("PATCH");
    expect(body().models[2]).toMatchObject({ label: "Turnkey", taxPercent: 8 });
    expect(body().notes).toEqual({ assumptions: null, exclusions: null });
    expect(await screen.findByRole("status")).toHaveTextContent(/rules saved/i);
    expect(refresh).toHaveBeenCalled();
  });

  it("toggles marble for a category", async () => {
    fetchMock.mockReturnValue(res({ rules: DEFAULT_ORG_RULES }));
    render(<RulesForm initial={DEFAULT_ORG_RULES} />);
    const user = userEvent.setup();
    const boxes = screen.getAllByRole("checkbox", {
      name: /marble in living areas/i,
    });
    expect(boxes[1]).not.toBeChecked();
    await user.click(boxes[1]);
    await user.click(save());
    expect(body().categories.B.marbleInLiving).toBe(true);
  });

  it("fills the automatic assumptions text and sends it as lines", async () => {
    fetchMock.mockReturnValue(res({ rules: DEFAULT_ORG_RULES }));
    render(<RulesForm initial={DEFAULT_ORG_RULES} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /fill with automatic text/i }),
    );
    expect(screen.getByLabelText("Basis of estimate")).toHaveValue(
      buildAssumptions(DEFAULT_ORG_RULES).join("\n"),
    );
    await user.click(save());
    expect(body().notes.assumptions).toEqual(
      buildAssumptions(DEFAULT_ORG_RULES),
    );
  });

  it("shows the server's validation error and no success message", async () => {
    fetchMock.mockReturnValue(
      res({ error: "Wall height must be a number between 6 and 30." }, 400),
    );
    render(<RulesForm initial={DEFAULT_ORG_RULES} />);
    await userEvent.setup().click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent(/wall height/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("asks for confirmation before resetting, then sends { reset: true }", async () => {
    fetchMock.mockReturnValue(res({ rules: DEFAULT_ORG_RULES }));
    render(<RulesForm initial={DEFAULT_ORG_RULES} />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /reset to defaults/i }),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: /reset to defaults/i }),
    );

    expect(body()).toEqual({ reset: true });
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cancelling the reset dialog does nothing", async () => {
    render(<RulesForm initial={DEFAULT_ORG_RULES} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /reset to defaults/i }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
