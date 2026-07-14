/** ui/spinner.tsx — inline + full-page loading spinners. */
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-fg-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
