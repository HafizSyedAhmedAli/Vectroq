// apps/web/src/components/intake/StepConfirm.tsx
import { FieldError } from "./fields";
import type { StepProps } from "./types";

export function StepConfirm({
  values,
  errors,
  setField,
  submitError,
}: StepProps & { submitError: string | null }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-brand-black">
        3. Contact Confirmation
      </h2>

      <div>
        <label
          htmlFor="consent"
          className="flex cursor-pointer items-start gap-2 text-sm text-stone-600"
        >
          <input
            id="consent"
            type="checkbox"
            checked={values.consent}
            onChange={(e) => setField("consent", e.target.checked)}
            className="mt-0.5 size-4 accent-brand"
          />
          I agree to be contacted regarding my project request.
        </label>
        <FieldError message={errors.consent} />
      </div>

      {submitError && (
        <p className="text-sm text-red-600" role="alert">
          {submitError}
        </p>
      )}
    </section>
  );
}
