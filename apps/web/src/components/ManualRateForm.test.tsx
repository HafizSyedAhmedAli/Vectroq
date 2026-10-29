import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ManualRateForm } from "./ManualRateForm";

const fetchMock = vi.fn();
const res = (body: unknown = {}, status = 200) =>
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

type U = ReturnType<typeof userEvent.setup>;
async function fillRequired(user: U) {
  await user.selectOptions(screen.getByLabelText("City"), "Karachi");
  await user.type(screen.getByLabelText("Bricks"), "20000");
  await user.type(screen.getByLabelText("Cement (50 kg bag)"), "1400");
  await user.type(screen.getByLabelText("Sand"), "60");
  await user.type(screen.getByLabelText("Steel bars"), "260000");
}
const save = () => screen.getByRole("button", { name: /save as draft/i });

describe("ManualRateForm", () => {
  it("requires a city", async () => {
    render(<ManualRateForm />);
    await userEvent.setup().click(save());
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a city.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names the first missing required material", async () => {
    render(<ManualRateForm />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("City"), "Karachi");
    await user.click(save());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a rate for Bricks.",
    );
  });

  it("rejects a non-positive rate", async () => {
    render(<ManualRateForm />);
    const user = userEvent.setup();
    await fillRequired(user);
    const bricks = screen.getByLabelText("Bricks");
    await user.clear(bricks);
    await user.type(bricks, "-5");
    await user.click(save());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bricks must be a positive number.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a draft with the four required materials only", async () => {
    fetchMock.mockReturnValue(res({ id: "d1" }, 201));
    render(<ManualRateForm />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(save());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/rate-sets");
    expect(JSON.parse(init.body)).toEqual({
      city: "Karachi",
      category: "B",
      items: [
        { itemType: "brick", unit: "1000nos", unitRate: 20000 },
        { itemType: "cement", unit: "bag", unitRate: 1400 },
        { itemType: "sand", unit: "cft", unitRate: 60 },
        { itemType: "steelMaterial", unit: "ton", unitRate: 260000 },
      ],
    });
  });

  it("includes optional items when filled and honours the chosen category", async () => {
    fetchMock.mockReturnValue(res({}, 201));
    render(
      <ManualRateForm
        categoryLabels={{ A: "Premium", B: "Standard", C: "Economy" }}
      />,
    );
    const user = userEvent.setup();
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText("Category"), "A");
    await user.type(screen.getByLabelText("Paint (optional)"), "45");
    await user.click(save());
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.category).toBe("A");
    expect(sent.items).toContainEqual({
      itemType: "paint",
      unit: "sqft",
      unitRate: 45,
    });
    expect(sent.items).toHaveLength(5);
  });

  it("clears the form, confirms and refreshes after saving", async () => {
    fetchMock.mockReturnValue(res({}, 201));
    render(<ManualRateForm />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(save());
    expect(await screen.findByRole("status")).toHaveTextContent(/draft saved/i);
    expect(screen.getByLabelText("Bricks")).toHaveValue(null);
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's reason and doesn't refresh", async () => {
    fetchMock.mockReturnValue(
      res({ error: "Choose a city from the list." }, 400),
    );
    render(<ManualRateForm />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a city from the list.",
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
  });
});
