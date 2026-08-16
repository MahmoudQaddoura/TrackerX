import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/apiClient";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) return setError("Your new password must contain at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("The new password and confirmation do not match.");
    if (newPassword === currentPassword) return setError("Choose a new password different from the temporary password.");
    setSaving(true);
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Could not update your password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl items-center justify-center py-8">
      <div className="grid w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-lg lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative overflow-hidden bg-gradient-to-br from-accent to-accent-hover p-8 text-white">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h1 className="mt-6 font-display text-2xl font-bold">Protect your TrackerX account</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Welcome, {user?.full_name}. Your administrator issued a temporary password. Replace it before opening your assigned projects.
            </p>
            <div className="mt-6 space-y-3 text-sm text-white/80">
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> At least 8 characters</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Different from the temporary password</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Visible only to you</p>
            </div>
          </div>
        </div>

        <Card className="rounded-none border-0 shadow-none">
          <CardContent className="p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 text-accent">
                <KeyRound className="h-5 w-5" />
                <span className="text-sm font-semibold">Required security step</span>
              </div>
              <h2 className="mt-2 font-display text-xl font-bold text-fg">Create your private password</h2>
              <p className="mt-1 text-sm text-fg-muted">Use the eye icon to show or hide any password while typing.</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Temporary password</Label>
                <PasswordInput id="current-password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <PasswordInput id="new-password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <PasswordInput id="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
              </div>
              {error && <p className="rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
              <Button className="w-full" type="submit" disabled={saving}>
                {saving && <Spinner />} Save password and continue
              </Button>
              <Button className="w-full" type="button" variant="ghost" onClick={logout}>Sign out instead</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
