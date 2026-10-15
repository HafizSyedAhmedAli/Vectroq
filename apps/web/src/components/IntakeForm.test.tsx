// apps/web/src/components/IntakeForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BUDGET_RANGES, TIMELINES } from "@tmcc/lead-intake";
import { IntakeForm } from "./IntakeForm";

type User = ReturnType<typeof userEvent.setup>;

const cont = (user: User) =>
  user.click(screen.getByRole("button", { name: /continue/i }));

async function fillStep1(user: User) {
  await user.type(screen.getByLabelText(/full name/i), "Ahmed Raza");
  await user.type(screen.getByLabelText(/contact/i), "+92-300-1234567");
  await user.selectOptions(screen.getByLabelText(/city/i), "Hyderabad");
  await user.click(
    screen.getByRole("radio", { name: /construction on client's plot/i }),
  );
  await cont(user);
}

async function fillStep2(user: User) {
  await user.click(screen.getByRole("radio", { name: "Villa" }));
  await user.selectOptions(screen.getByLabelText(/number of floors/i), "2");
  await user.selectOptions(screen.getByLabelText(/bedrooms/i), "3");
  await user.selectOptions(
    screen.getByLabelText(/budget range/i),
    BUDGET_RANGES[2],
  );
  await user.type(screen.getByLabelText(/plot size/i), "240");
  await user.type(screen.getByLabelText(/covered area/i), "1800");
  await user.selectOptions(screen.getByLabelText(/timeline/i), TIMELINES[1]);
  await user.click(screen.getByRole("radio", { name: "Category B" }));
  await cont(user);
}

const agree = (user: User) =>
  user.click(screen.getByRole("checkbox", { name: /agree to be contacted/i }));
const submitBtn = () => screen.getByRole("button", { name: /submit/i });

describe("IntakeForm — wizard", () => {
  it("walks through all three steps and submits the complete payload", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ estimate: null });
    render(<IntakeForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await fillStep1(user);
    expect(screen.getByText(/house requirements/i)).toBeInTheDocument();
    await fillStep2(user);
    expect(screen.getByText(/contact confirmation/i)).toBeInTheDocument();
    await agree(user);
    await user.click(submitBtn());

    expect(onSubmit).toHaveBeenCalledWith(
      {
        name: "Ahmed Raza",
        contact: "+92-300-1234567",
        city: "Hyderabad",
        model: 2,
        category: "B",
        houseType: "Villa",
        floors: 2,
        bedrooms: 3,
        plotSizeSqYd: 240,
        coveredAreaSqFt: 1800,
        budgetRange: BUDGET_RANGES[2],
        timeline: TIMELINES[1],
        additionalNotes: undefined,
        consent: true,
      },
      null,
    );
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
  });

  it("does not leave step 1 until its required fields are valid (FR-4)", async () => {
    const onSubmit = vi.fn();
    render(<IntakeForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await cont(user);

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/city is required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/engagement model is required/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/house requirements/i)).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not leave step 2 until the requirements are valid", async () => {
    render(<IntakeForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    await fillStep1(user);

    await cont(user);

    expect(
      await screen.findByText(/house type is required/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/number of floors is required/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/plot size is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/contact confirmation/i)).not.toBeInTheDocument();
  });

  it("blocks submission until the user agrees to be contacted", async () => {
    const onSubmit = vi.fn();
    render(<IntakeForm onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await fillStep1(user);
    await fillStep2(user);

    await user.click(submitBtn());

    expect(
      await screen.findByText(/please agree to be contacted/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps entered values when going back", async () => {
    render(<IntakeForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    await fillStep1(user);

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByLabelText(/full name/i)).toHaveValue("Ahmed Raza");
    expect(screen.getByLabelText(/city/i)).toHaveValue("Hyderabad");
  });

  it("only offers the predefined cities and models (FR-4)", () => {
    render(<IntakeForm onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("option", { name: "Hyderabad" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Atlantis" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("passes an uploaded plot plan to onSubmit", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ estimate: null });
    render(<IntakeForm onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await fillStep1(user);

    const file = new File(["%PDF"], "plan.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/upload plot plan/i), file);
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();

    await fillStep2(user);
    await agree(user);
    await user.click(submitBtn());

    expect(onSubmit.mock.calls[0][1]).toBe(file);
  });

  it("rejects an unsupported file with a message and does not attach it", async () => {
    render(<IntakeForm onSubmit={vi.fn()} />);
    // applyAccept:false so the browser-level accept filter doesn't hide the case
    const user = userEvent.setup({ applyAccept: false });
    await fillStep1(user);

    await user.upload(
      screen.getByLabelText(/upload plot plan/i),
      new File(["x"], "malware.exe"),
    );

    expect(
      await screen.findByText(/unsupported file type/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("malware.exe")).not.toBeInTheDocument();
  });

  it("lets the user remove an attached file", async () => {
    render(<IntakeForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    await fillStep1(user);
    await user.upload(
      screen.getByLabelText(/upload plot plan/i),
      new File(["%PDF"], "plan.pdf"),
    );

    await user.click(
      screen.getByRole("button", { name: /remove uploaded file/i }),
    );

    expect(screen.queryByText("plan.pdf")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/upload plot plan/i)).toBeInTheDocument();
  });

  it("disables the submit button while onSubmit is pending (UX)", async () => {
    let resolveSubmit!: (v: { estimate: null }) => void;
    const pending = new Promise<{ estimate: null }>((r) => (resolveSubmit = r));
    render(<IntakeForm onSubmit={vi.fn().mockReturnValue(pending)} />);
    const user = userEvent.setup();
    await fillStep1(user);
    await fillStep2(user);
    await agree(user);

    const button = submitBtn();
    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/submitting/i);

    resolveSubmit({ estimate: null });
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
  });

  it("shows the server's error and keeps the form when submission fails", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new Error("Failed to submit lead"));
    render(<IntakeForm onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await fillStep1(user);
    await fillStep2(user);
    await agree(user);

    await user.click(submitBtn());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to submit lead/i,
    );
    expect(submitBtn()).toBeEnabled();
  });

  it("shows the price range on the thank-you screen when an estimate exists", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      estimate: { lineItems: [], subtotal: 0, tax: 0, total: 6_600_000 },
    });
    render(<IntakeForm onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await fillStep1(user);
    await fillStep2(user);
    await agree(user);
    await user.click(submitBtn());

    expect(
      await screen.findByText(/rough starting range/i),
    ).toBeInTheDocument();
  });

  it("returns to an empty form from the thank-you screen", async () => {
    render(
      <IntakeForm onSubmit={vi.fn().mockResolvedValue({ estimate: null })} />,
    );
    const user = userEvent.setup();
    await fillStep1(user);
    await fillStep2(user);
    await agree(user);
    await user.click(submitBtn());

    await user.click(
      await screen.findByRole("button", { name: /back to homepage/i }),
    );

    expect(screen.getByLabelText(/full name/i)).toHaveValue("");
  });
});
