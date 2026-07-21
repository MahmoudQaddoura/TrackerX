/** layout/BrandLogo.tsx — the app mark + wordmark. */
import { cn } from "@/lib/utils";

const trackerXLogo = "/x.png";

export function BrandLogo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img src={trackerXLogo} alt="TrackerX logo" className="h-7 w-7 rounded-md object-contain" />
      {showText && <span className="font-display text-base font-bold text-fg">TrackerX</span>}
    </div>
  );
}
