// apps/web/src/components/intake/StepActions.tsx
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepActionsProps {
  isFirst: boolean;
  isLast: boolean;
  isSubmitting: boolean;
  onBack: () => void;
}

// The Continue and Submit buttons have different keys on purpose: React must
// not reuse one DOM node for both, or a click on Continue could immediately
// submit the form on the last step.
export function StepActions({
  isFirst,
  isLast,
  isSubmitting,
  onBack,
}: StepActionsProps) {
  const big = "h-12! rounded-xl! text-[15px] font-semibold cursor-pointer";
  return (
    <div className="flex gap-3">
      {!isFirst && (
        <Button
          key="back"
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className={big}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
      )}
      {isLast ? (
        <Button
          key="submit"
          type="submit"
          disabled={isSubmitting}
          className={`${big} flex-1 bg-brand text-white shadow-md shadow-brand/25 hover:bg-brand-dark disabled:cursor-not-allowed`}
        >
          <Send className="size-4" />
          {isSubmitting ? "Submitting…" : "Submit Project Request →"}
        </Button>
      ) : (
        <Button
          key="next"
          type="submit"
          className={`${big} flex-1 bg-brand text-white shadow-md shadow-brand/25 hover:bg-brand-dark`}
        >
          Continue →
        </Button>
      )}
    </div>
  );
}
