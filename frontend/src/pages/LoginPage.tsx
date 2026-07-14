/**
 * pages/LoginPage.tsx
 * Email/password sign-in. Redirects to the intended page (or /dashboard) on
 * success. Shows the demo credentials for convenience.
 */
import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { BrandLogo } from "@/components/layout/BrandLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/apiClient";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Invalid email or password."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <BrandLogo showText={false} />
            <h1 className="font-display text-xl font-bold text-fg">Project Task Tracker</h1>
            <p className="text-sm text-fg-muted">Sign in to continue</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner />} Sign in
            </Button>
          </form>

          <div className="mt-6 rounded-md border border-border bg-raised/50 p-3 text-xs text-fg-muted">
            <p className="font-medium text-fg">Demo accounts</p>
            <p className="mt-1">PM: pm@demo.com</p>
            <p>Owner: owner@demo.com</p>
            <p>Password: ChangeMe123!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
