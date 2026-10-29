import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { TeamPanel, type InviteRow, type MemberRow } from "./TeamPanel";

const fetchMock = vi.fn();
const res = (body: unknown = {}, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });

const members: MemberRow[] = [
  {
    id: "m1",
    name: "Sara Owner",
    email: "sara@x.co",
    role: "OWNER",
    isYou: true,
  },
  {
    id: "m2",
    name: "Bilal Viewer",
    email: "bilal@x.co",
    role: "VIEWER",
    isYou: false,
  },
];
const invites: InviteRow[] = [
  {
    id: "i1",
    email: "pending@x.co",
    role: "ESTIMATOR",
    expiresLabel: "1 Nov 2026",
  },
];

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const lastCall = () => fetchMock.mock.calls.at(-1)!;

describe("TeamPanel", () => {
  it("lists members, marks you, and lists pending invitations", () => {
    render(<TeamPanel members={members} invites={invites} />);
    expect(screen.getByText(/Sara Owner \(you\)/)).toBeInTheDocument();
    expect(screen.getByText("bilal@x.co")).toBeInTheDocument();
    expect(screen.getByText("Pending invitations (1)")).toBeInTheDocument();
    expect(screen.getByText("pending@x.co")).toBeInTheDocument();
  });

  it("keeps the invite button disabled until an email is typed", async () => {
    render(<TeamPanel members={members} invites={[]} />);
    const btn = screen.getByRole("button", { name: /create invite link/i });
    expect(btn).toBeDisabled();
    await userEvent
      .setup()
      .type(screen.getByLabelText("Invite email"), "new@x.co");
    expect(btn).toBeEnabled();
  });

  it("creates an invite and shows the link once", async () => {
    fetchMock.mockReturnValue(
      res({ link: "https://app/invite/tok", emailed: true }),
    );
    render(<TeamPanel members={members} invites={[]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Invite email"), "new@x.co");
    await user.selectOptions(screen.getByLabelText("Invite role"), "ESTIMATOR");
    await user.click(
      screen.getByRole("button", { name: /create invite link/i }),
    );

    const [url, init] = lastCall();
    expect(url).toBe("/api/team/invites");
    expect(JSON.parse(init.body)).toEqual({
      email: "new@x.co",
      role: "ESTIMATOR",
    });
    expect(await screen.findByLabelText("Invitation link")).toHaveValue(
      "https://app/invite/tok",
    );
    expect(screen.getByText(/we also emailed it/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Invite email")).toHaveValue("");
    expect(refresh).toHaveBeenCalled();
  });

  it("says so when email isn't set up", async () => {
    fetchMock.mockReturnValue(
      res({ link: "https://app/invite/t", emailed: false }),
    );
    render(<TeamPanel members={members} invites={[]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Invite email"), "a@x.co");
    await user.click(
      screen.getByRole("button", { name: /create invite link/i }),
    );
    expect(await screen.findByText(/email isn't set up/i)).toBeInTheDocument();
  });

  it("shows the server error when inviting fails", async () => {
    fetchMock.mockReturnValue(
      res({ error: "That person is already on your team." }, 409),
    );
    render(<TeamPanel members={members} invites={[]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Invite email"), "bilal@x.co");
    await user.click(
      screen.getByRole("button", { name: /create invite link/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already on your team",
    );
  });

  it("changes a member's role from the dropdown", async () => {
    fetchMock.mockReturnValue(res());
    render(<TeamPanel members={members} invites={[]} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Change role for Bilal Viewer" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /estimator.*projects, drawings and rates/i,
      }),
    );
    const [url, init] = lastCall();
    expect(url).toBe("/api/team/members/m2");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ role: "ESTIMATOR" });
  });

  it("choosing the current role makes no request", async () => {
    render(<TeamPanel members={members} invites={[]} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Change role for Bilal Viewer" }),
    );
    await user.click(
      screen.getByRole("button", { name: /viewer.*read-only access/i }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes a member only after confirming", async () => {
    fetchMock.mockReturnValue(res());
    render(<TeamPanel members={members} invites={[]} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "More actions for Bilal Viewer" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Remove Bilal Viewer" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog", {
      name: "Remove team member?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Remove member" }),
    );
    expect(lastCall()[0]).toBe("/api/team/members/m2");
    expect(lastCall()[1].method).toBe("DELETE");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cancelling member removal sends nothing", async () => {
    render(<TeamPanel members={members} invites={[]} />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "More actions for Bilal Viewer" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Remove Bilal Viewer" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("revokes a pending invitation after an inline confirm", async () => {
    fetchMock.mockReturnValue(res());
    render(<TeamPanel members={members} invites={invites} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(screen.getByText("Revoke?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, revoke" }));

    expect(lastCall()[0]).toBe("/api/team/invites/i1");
    expect(lastCall()[1].method).toBe("DELETE");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Invitation for pending@x.co was revoked.",
    );
    expect(screen.queryByText("pending@x.co")).not.toBeInTheDocument();
  });

  it("shows an error when revoking fails and keeps the row", async () => {
    fetchMock.mockReturnValue(res({ error: "nope" }, 500));
    render(<TeamPanel members={members} invites={invites} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: "Yes, revoke" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("nope");
    expect(screen.getByText("pending@x.co")).toBeInTheDocument();
  });
});
