// apps/web/src/components/IntakeForm.tsx
"use client";

import type { Category, EngagementModel } from "@vectroq/shared-types";
import { CATEGORY_OPTIONS, MODEL_OPTIONS } from "./intake/option-config";
import { IntakeStepper } from "./intake/IntakeStepper";
import { ProjectSummary } from "./intake/ProjectSummary";
import { StepActions } from "./intake/StepActions";
import { StepConfirm } from "./intake/StepConfirm";
import { StepProjectDetails } from "./intake/StepProjectDetails";
import { StepRequirements } from "./intake/StepRequirements";
import { ThankYou } from "./intake/ThankYou";
import type { IntakeSubmitHandler } from "./intake/types";
import { STEPS, useIntakeForm } from "./intake/useIntakeForm";
import type { CardOption } from "./intake/OptionCards";

export type { IntakeSubmitResult } from "./intake/types";

interface IntakeFormProps {
  onSubmit: IntakeSubmitHandler;
  modelOptions?: CardOption<EngagementModel>[];
  categoryOptions?: CardOption<Category>[];
}

// Three-step wizard: Project Details -> Requirements -> Contact. Each step is
// validated before the next one opens; the final step submits.
export function IntakeForm({
  onSubmit,
  modelOptions = MODEL_OPTIONS,
  categoryOptions = CATEGORY_OPTIONS,
}: IntakeFormProps) {
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
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
      <form
        onSubmit={form.handleSubmit}
        noValidate
        className="space-y-6 rounded-3xl border border-stone-200/70 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-8"
      >
        <IntakeStepper
          steps={STEPS}
          current={form.step}
          onStepClick={form.goTo}
        />

        <hr className="border-stone-100" />

        {form.step === 0 && (
          <StepProjectDetails {...stepProps} modelOptions={modelOptions} />
        )}
        {form.step === 1 && (
          <StepRequirements
            {...stepProps}
            categoryOptions={categoryOptions}
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

      <ProjectSummary
        values={form.values}
        modelOptions={modelOptions}
        categoryOptions={categoryOptions}
      />
    </div>
  );
}
