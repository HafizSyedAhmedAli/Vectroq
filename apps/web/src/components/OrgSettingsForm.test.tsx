import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { OrgSettingsForm, type OrgSettingsInitial } from "./OrgSettingsForm";

const fetchMock = vi.fn();
const res = (body: unknown = {}, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });

const initial: OrgSettingsInitial = {
  name: "Acme",
  tagline: "Built to last",
  primaryColor: "#2563EB",
  phone: "0300-1",
  email: "a@acme.co",
  website: "acme.co",
  logoUrl: null,
  offices: [{ title: "HQ", address: "Karachi" }],
};

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const saveBtn = () => screen.getByRole("button", { name: /save settings/i });

describe("OrgSettingsForm", () => {
  it("prefills the company details and offices", () => {
    render(<OrgSettingsForm initial={initial} />);
    expect(screen.getByLabelText("Company name")).toHaveValue("Acme");
    expect(screen.getByLabelText("Office 1 title")).toHaveValue("HQ");
    expect(screen.getByLabelText("Office 1 address")).toHaveValue("Karachi");
  });

  it("saves edits without sending the logo url", async () => {
    fetchMock.mockReturnValue(res({ id: "o1" }));
    render(
      <OrgSettingsForm initial={{ ...initial, logoUrl: "http://l.png" }} />,
    );
    const user = userEvent.setup();
    const name = screen.getByLabelText("Company name");
    await user.clear(name);
    await user.type(name, "Acme Builders");
    await user.click(saveBtn());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/org");
    expect(init.method).toBe("PATCH");
    const sent = JSON.parse(init.body);
    expect(sent.name).toBe("Acme Builders");
    expect(sent).not.toHaveProperty("logoUrl");
    expect(await screen.findByRole("status")).toHaveTextContent(
      /settings saved/i,
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("blocks an invalid colour before calling the API", async () => {
    render(<OrgSettingsForm initial={initial} />);
    const user = userEvent.setup();
    const hex = document.querySelector<HTMLInputElement>("#o-color-hex")!;
    await user.clear(hex);
    await user.type(hex, "zzz");
    await user.click(saveBtn());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Brand color must look like #2563EB.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds an office (max 5) and removes one", async () => {
    render(<OrgSettingsForm initial={initial} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /add office/i }));
    expect(screen.getByLabelText("Office 2 title")).toBeInTheDocument();
    for (let i = 0; i < 3; i++)
      await user.click(screen.getByRole("button", { name: /add office/i }));
    expect(screen.getByLabelText("Office 5 title")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add office/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove office 1" }));
    expect(screen.queryByLabelText("Office 5 title")).not.toBeInTheDocument();
  });

  it("shows the server error", async () => {
    fetchMock.mockReturnValue(
      res({ error: "Each office needs a title and an address." }, 400),
    );
    render(<OrgSettingsForm initial={initial} />);
    await userEvent.setup().click(saveBtn());
    expect(await screen.findByRole("alert")).toHaveTextContent(/each office/i);
  });

  it("uploads a logo and shows it", async () => {
    fetchMock.mockReturnValue(res({ logoUrl: "https://blob/logo.png" }));
    const { container } = render(<OrgSettingsForm initial={initial} />);
    const file = new File([new Uint8Array(5)], "logo.png", {
      type: "image/png",
    });
    await userEvent
      .setup()
      .upload(container.querySelector("#logo-file")!, file);

    expect(await screen.findByAltText("Logo")).toHaveAttribute(
      "src",
      "https://blob/logo.png",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/org/logo");
    expect(init.body).toBeInstanceOf(FormData);
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an upload error", async () => {
    fetchMock.mockReturnValue(res({ error: "Logo must be under 1 MB." }, 400));
    const { container } = render(<OrgSettingsForm initial={initial} />);
    await userEvent
      .setup()
      .upload(
        container.querySelector("#logo-file")!,
        new File(["x"], "l.png", { type: "image/png" }),
      );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Logo must be under 1 MB.",
    );
  });

  it("removes the logo", async () => {
    fetchMock.mockReturnValue(res({ ok: true }));
    render(
      <OrgSettingsForm initial={{ ...initial, logoUrl: "http://l.png" }} />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Remove" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      removeLogo: true,
    });
    expect(screen.queryByAltText("Logo")).not.toBeInTheDocument();
  });
});
