import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { BUDGET_RANGES, TIMELINES } from "@vectroq/lead-intake";
import { useIntakeForm } from "./useIntakeForm";

const evt = () => ({ preventDefault: vi.fn() }) as never;

function setup(onSubmit: any = vi.fn().mockResolvedValue({ estimate: null })) {
  const h = renderHook(() => useIntakeForm(onSubmit));
  const f = () => h.result.current;
  const go = () => act(() => f().handleSubmit(evt()));
  const fill1 = () =>
    act(() => {
      f().setField("name", "Ali");
      f().setField("contact", "0300");
      f().setField("city", "Karachi");
      f().setField("model", 2);
    });
  const fill2 = () =>
    act(() => {
      f().setField("houseType", "Villa");
      f().setField("floors", "2");
      f().setField("bedrooms", "3");
      f().setField("plotSizeSqYd", "240");
      f().setField("coveredAreaSqFt", "1800");
      f().setField("budgetRange", BUDGET_RANGES[2]);
      f().setField("timeline", TIMELINES[1]);
      f().setField("category", "B");
    });
  const toLastStep = async () => {
    await fill1();
    await go();
    await fill2();
    await go();
    await act(() => f().setField("consent", true));
  };
  return { h, f, go, fill1, fill2, toLastStep, onSubmit };
}

describe("navigation", () => {
  it("starts at step 0 with empty values", () => {
    const { f } = setup();
    expect(f()).toMatchObject({ step: 0, isLastStep: false });
    expect(f().values.name).toBe("");
  });

  it("blocks Continue on an invalid step and lists the errors", async () => {
    const { f, go } = setup();
    await go();
    expect(f().step).toBe(0);
    expect(Object.keys(f().errors)).toEqual(
      expect.arrayContaining(["name", "contact", "city", "model"]),
    );
  });

  it("advances through valid steps to the last", async () => {
    const { f, go, fill1, fill2 } = setup();
    await fill1();
    await go();
    expect(f().step).toBe(1);
    await fill2();
    await go();
    expect(f().step).toBe(2);
    expect(f().isLastStep).toBe(true);
  });

  it("typing clears only that field's error", async () => {
    const { f, go } = setup();
    await go();
    await act(() => f().setField("name", "A"));
    expect(f().errors.name).toBeUndefined();
    expect(f().errors.contact).toBeDefined();
  });

  it("back goes one step, clears errors and stops at 0", async () => {
    const { f, go, fill1 } = setup();
    await fill1();
    await go();
    await go(); // invalid step 2 -> errors
    expect(Object.keys(f().errors).length).toBeGreaterThan(0);
    await act(() => f().back());
    expect(f()).toMatchObject({ step: 0, errors: {} });
    await act(() => f().back());
    expect(f().step).toBe(0);
  });

  it("goTo only goes backwards", async () => {
    const { f, go, fill1 } = setup();
    await fill1();
    await go();
    await act(() => f().goTo(2));
    expect(f().step).toBe(1);
    await act(() => f().goTo(0));
    expect(f().step).toBe(0);
  });
});

describe("submission", () => {
  it("sends the typed payload and stores the result", async () => {
    const { f, go, toLastStep, onSubmit } = setup();
    await toLastStep();
    await act(async () => f().handleSubmit(evt()));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ali",
        city: "Karachi",
        model: 2,
        floors: 2,
        plotSizeSqYd: 240,
        consent: true,
      }),
      null,
    );
    expect(f().result).toEqual({ estimate: null });
    expect(f().isSubmitting).toBe(false);
    void go;
  });

  it("sends the visitor back to the first invalid step", async () => {
    const { f, toLastStep, onSubmit } = setup();
    await toLastStep();
    await act(() => f().setField("contact", ""));
    await act(async () => f().handleSubmit(evt()));
    expect(f().step).toBe(0);
    expect(f().errors.contact).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the thrown message, or a generic one", async () => {
    const a = setup(
      vi.fn().mockRejectedValue(new Error("Failed to submit lead")),
    );
    await a.toLastStep();
    await act(async () => a.f().handleSubmit(evt()));
    expect(a.f().submitError).toBe("Failed to submit lead");

    for (const err of ["boom", new Error("")]) {
      const b = setup(vi.fn().mockRejectedValue(err));
      await b.toLastStep();
      await act(async () => b.f().handleSubmit(evt()));
      expect(b.f().submitError).toBe(
        "We couldn't submit your request. Please try again.",
      );
    }
  });

  it("treats an undefined response as no estimate", async () => {
    const { f, toLastStep } = setup(vi.fn().mockResolvedValue(undefined));
    await toLastStep();
    await act(async () => f().handleSubmit(evt()));
    expect(f().result).toEqual({ estimate: null });
  });

  it("ignores a second submit while one is in flight", async () => {
    const onSubmit = vi.fn(() => new Promise(() => {}));
    const { f, toLastStep } = setup(onSubmit);
    await toLastStep();
    await act(async () => f().handleSubmit(evt()));
    expect(f().isSubmitting).toBe(true);
    await act(async () => f().handleSubmit(evt()));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("reset returns to a blank form", async () => {
    const { f, toLastStep } = setup();
    await toLastStep();
    await act(async () => f().handleSubmit(evt()));
    await act(() => f().reset());
    expect(f()).toMatchObject({ step: 0, result: null, submitError: null });
    expect(f().values.name).toBe("");
  });
});

describe("choosePlanFile", () => {
  it("clears on null", async () => {
    const { f } = setup();
    await act(() => f().choosePlanFile(null));
    expect(f()).toMatchObject({ planFile: null, planFileError: null });
  });

  it("rejects an unsupported type", async () => {
    const { f } = setup();
    await act(() => f().choosePlanFile(new File(["x"], "virus.exe")));
    expect(f().planFile).toBeNull();
    expect(f().planFileError).toMatch(/unsupported/i);
  });

  it("accepts a real PDF", async () => {
    const { f } = setup();
    const file = new File(["%PDF-1.7"], "plan.pdf");
    await act(async () => {
      await f().choosePlanFile(file);
    });
    expect(f().planFile).toBe(file);
    expect(f().planFileError).toBeNull();
  });

  it("rejects contents that don't match the extension", async () => {
    const { f } = setup();
    await act(async () => {
      await f().choosePlanFile(new File(["MZ not a pdf"], "fake.pdf"));
    });
    expect(f().planFile).toBeNull();
    expect(f().planFileError).toMatch(/don't match/i);
  });
});
