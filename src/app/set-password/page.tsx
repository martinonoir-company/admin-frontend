"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { authApi } from "@/lib/api";

// Mirrors the backend ResetPasswordDto rules (auth.dto.ts) so users get
// instant feedback instead of a round-trip rejection.
const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "A number", test: (p) => /\d/.test(p) },
  { label: "A special character", test: (p) => /[!@#$%^&*()\-_=+{};:,<.>]/.test(p) },
];

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const failedRules = PASSWORD_RULES.filter((r) => !r.test(password));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (failedRules.length > 0) {
      setError("Password does not meet all the requirements below.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not set password. The link may have expired — ask for a new invitation.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary-900/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-primary-700/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/martino_logo.png"
            alt="Martino Noir"
            width={220}
            height={140}
            priority
            className="h-auto w-[200px] invert"
          />
          <p className="text-sm text-ink-400 mt-3 tracking-[0.25em] uppercase">Admin Portal</p>
        </div>

        <div className="bg-ink-800 border border-ink-700 rounded-xl p-7 shadow-xl">
          {!token ? (
            <>
              <h2 className="text-base font-semibold text-ink-200 mb-3">Invalid activation link</h2>
              <p className="text-sm text-ink-400 leading-relaxed">
                This link is missing its activation token. Open the link from your invitation
                email again, or ask an administrator to send a new invitation.
              </p>
            </>
          ) : done ? (
            <div className="flex flex-col items-center text-center py-4 animate-fade-in">
              <CheckCircle2 size={40} className="text-success mb-4" />
              <h2 className="text-base font-semibold text-ink-200 mb-2">Password set</h2>
              <p className="text-sm text-ink-400 leading-relaxed mb-4">
                Your account is active. Redirecting you to sign in…
              </p>
              <Link href="/login" className="btn-primary px-6 py-2">
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-ink-200 mb-1">Set your password</h2>
              <p className="text-sm text-ink-400 mb-6">
                Choose a password to activate your staff account.
              </p>

              {error && (
                <div className="flex items-start gap-3 p-3 mb-5 bg-danger/10 border border-danger/25 rounded-lg animate-fade-in">
                  <AlertCircle size={16} className="text-danger mt-0.5 shrink-0" />
                  <p className="text-sm text-danger leading-relaxed">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="password" className="admin-label">New password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPass ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="admin-input pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm" className="admin-label">Confirm password</label>
                  <input
                    id="confirm"
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="admin-input"
                    disabled={loading}
                  />
                </div>

                <ul className="space-y-1 pt-1">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={`text-xs flex items-center gap-2 ${ok ? "text-success" : "text-ink-500"}`}
                      >
                        <span className="w-3.5 text-center">{ok ? "✓" : "•"}</span>
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Setting password…
                    </>
                  ) : (
                    "Set Password & Activate"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-ink-600 mt-6">
          Martino Noir Unified Commerce System
        </p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ink-900 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}
