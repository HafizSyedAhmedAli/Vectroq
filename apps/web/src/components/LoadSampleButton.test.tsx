// apps/web/src/components/LoadSampleButton.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { LoadSampleButton } from "./LoadSampleButton";

const fetchMock = vi.fn();
const res = (body: unknown = {}, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("LoadSampleButton", () => {
  it("creates the sample project and opens it", async () => {
    fetchMock.mockReturnValue(res({ projectId: "p7" }, 201));
    render(<LoadSampleButton />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /load sample project/i }));
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/sample-project", {
      method: "POST",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/office/p7"));
  });

  it("disables itself while working", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<LoadSampleButton />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /load sample project/i }));
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
  });

  it("shows an error and re-enables", async () => {
    fetchMock.mockReturnValue(
      res({ error: "Could not create the sample project." }, 500),
    );
    render(<LoadSampleButton />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /load sample project/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not create the sample project.",
    );
    expect(
      screen.getByRole("button", { name: /load sample project/i }),
    ).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });
});
