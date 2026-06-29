"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { login } from "@/app/actions/auth";
import { ShieldAlert, Eye, EyeOff } from "lucide-react";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = await login(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[var(--color-primary)] opacity-[0.03] blur-[120px]" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[var(--color-primary)] opacity-[0.03] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[400px] animate-fade-in">
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="HyperThings Logo"
            width={180}
            height={60}
            className="mb-2 object-contain"
            priority
          />
          <p className="text-[14px] text-[var(--color-text-muted)] mt-1">
            Secure admin portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 shadow-2xl shadow-[var(--color-shadow)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 dark:bg-red-950/40 dark:border-red-900 flex items-start gap-3 animate-fade-in">
                <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[13px] font-medium text-red-700 dark:text-red-400 leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider ml-1"
              >
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-3 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider ml-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-3 pr-10 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded-md outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 text-[14px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
