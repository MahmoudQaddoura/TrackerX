/** pages/NotFoundPage.tsx — 404 fallback inside the app shell. */
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="font-display text-4xl font-bold text-fg">404</p>
      <p className="text-fg-muted">This page could not be found.</p>
      <Button asChild variant="outline">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
