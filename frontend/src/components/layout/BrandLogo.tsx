/** layout/BrandLogo.tsx — the app mark + wordmark. */
import { cn } from "@/lib/utils";

export function BrandLogo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <defs>
          <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent))" />
            <stop offset="100%" stopColor="hsl(var(--accent-hover))" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#aurora)" />
        <path
          d="M9 20l4-8 3 5 2-3 4 6"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showText && <span className="font-display text-base font-bold text-fg">Task Tracker</span>}
    </div>
  );
}
