/** ui/error-state.tsx — error block with optional retry. */
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-danger" />
      <div>
        <p className="font-medium text-fg">Something went wrong</p>
        <p className="mt-1 text-sm text-fg-muted">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
