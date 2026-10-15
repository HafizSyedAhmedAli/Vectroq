// apps/web/src/components/intake/useIntakeForm.ts
"use client";

import { useState, type FormEvent } from "react";
import {
  validateConfirmation,
  validateLeadIntake,
  validatePlanFile,
  validateProjectDetails,
  validateRequirements,
  type LeadIntakeErrors,
  type LeadIntakeInput,
} from "@tmcc/lead-intake";
import {
  EMPTY_VALUES,
  toLeadInput,
  type IntakeFormValues,
  type IntakeSubmitHandler,
  type IntakeSubmitResult,
  type SetField,
} from "./types";

export const STEPS = [
  { id: "details", label: "Project Details" },
  { id: "requirements", label: "Requirements" },
  { id: "confirm", label: "Contact" },
] as const;

const STEP_VALIDATORS = [
  validateProjectDetails,
  validateRequirements,
  validateConfirmation,
] as const;

// All wizard state and transitions live here so the components stay dumb.
export function useIntakeForm(onSubmit: IntakeSubmitHandler) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<IntakeFormValues>(EMPTY_VALUES);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planFileError, setPlanFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<LeadIntakeErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeSubmitResult | null>(null);

  const isLastStep = step === STEPS.length - 1;

  const setField: SetField = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key as keyof LeadIntakeErrors];
      return next;
    });
  };

  function choosePlanFile(file: File | null) {
    if (!file) {
      setPlanFile(null);
      setPlanFileError(null);
      return;
    }
    const problem = validatePlanFile(file);
    setPlanFileError(problem);
    setPlanFile(problem ? null : file);
  }

  function next() {
    const { valid, errors: stepErrors } = STEP_VALIDATORS[step](
      toLeadInput(values),
    );
    setErrors(stepErrors);
    if (valid) setStep((s) => s + 1);
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  function goTo(index: number) {
    if (index < step) {
      setErrors({});
      setStep(index);
    }
  }

  async function submit() {
    const input = toLeadInput(values);
    // Safety net: send the user back to the first step that is still invalid.
    if (!validateLeadIntake(input).valid) {
      const failing = STEP_VALIDATORS.findIndex((v) => !v(input).valid);
      setStep(failing);
      setErrors(STEP_VALIDATORS[failing](input).errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await onSubmit(input as LeadIntakeInput, planFile);
      setResult(res ?? { estimate: null });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "We couldn't submit your request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault(); // Enter also advances steps
    if (isSubmitting) return;
    if (isLastStep) void submit();
    else next();
  }

  function reset() {
    setStep(0);
    setValues(EMPTY_VALUES);
    setPlanFile(null);
    setPlanFileError(null);
    setErrors({});
    setSubmitError(null);
    setResult(null);
  }

  return {
    step,
    isLastStep,
    values,
    errors,
    planFile,
    planFileError,
    isSubmitting,
    submitError,
    result,
    setField,
    choosePlanFile,
    back,
    goTo,
    handleSubmit,
    reset,
  };
}
