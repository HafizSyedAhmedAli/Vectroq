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
  return (
    <div className="flex gap-3">
      {!isFirst && (
        <Button
          key="back"
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="h-11 cursor-pointer"
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
          className="flex-1 h-11 text-sm font-semibold bg-brand hover:bg-brand-dark text-white cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="size-4" />
          {isSubmitting ? "Submitting…" : "Submit Project Request →"}
        </Button>
      ) : (
        <Button
          key="next"
          type="submit"
          className="flex-1 h-11 text-sm font-semibold bg-brand hover:bg-brand-dark text-white cursor-pointer"
        >
          Continue →
        </Button>
      )}
    </div>
  );
}
