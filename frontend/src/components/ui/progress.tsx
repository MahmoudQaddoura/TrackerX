/** ui/progress.tsx — determinate progress bar (Radix Progress). */
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const Progress = forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-raised", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full bg-accent transition-transform", indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = "Progress";
