// apps/web/src/components/IntakeForm.tsx
"use client";

import { IntakeStepper } from "./intake/IntakeStepper";
import { ProjectSummary } from "./intake/ProjectSummary";
import { StepActions } from "./intake/StepActions";
import { StepConfirm } from "./intake/StepConfirm";
import { StepProjectDetails } from "./intake/StepProjectDetails";
import { StepRequirements } from "./intake/StepRequirements";
import { ThankYou } from "./intake/ThankYou";
import type { IntakeSubmitHandler } from "./intake/types";
import { STEPS, useIntakeForm } from "./intake/useIntakeForm";

export type { IntakeSubmitResult } from "./intake/types";

interface IntakeFormProps {
  onSubmit: IntakeSubmitHandler;
}

// Three-step wizard: Project Details -> Requirements -> Contact. Each step is
// validated before the next one opens; the final step submits.
export function IntakeForm({ onSubmit }: IntakeFormProps) {
  const form = useIntakeForm(onSubmit);

  if (form.result) {
    return <ThankYou result={form.result} onReset={form.reset} />;
  }

  const stepProps = {
    values: form.values,
    errors: form.errors,
    setField: form.setField,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_290px] items-start">
      <form
        onSubmit={form.handleSubmit}
        noValidate
        className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-8"
      >
        <IntakeStepper
          steps={STEPS}
          current={form.step}
          onStepClick={form.goTo}
        />

        <hr className="border-stone-100" />

        {form.step === 0 && <StepProjectDetails {...stepProps} />}
        {form.step === 1 && (
          <StepRequirements
            {...stepProps}
            planFile={form.planFile}
            planFileError={form.planFileError}
            onPlanFileChange={form.choosePlanFile}
          />
        )}
        {form.step === 2 && (
          <StepConfirm {...stepProps} submitError={form.submitError} />
        )}

        <StepActions
          isFirst={form.step === 0}
          isLast={form.isLastStep}
          isSubmitting={form.isSubmitting}
          onBack={form.back}
        />
      </form>

      <ProjectSummary values={form.values} />
    </div>
  );
}
