"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ShieldCheckIcon,
  LockIcon,
  UserIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  CheckIcon,
  ShieldIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { apiClient, setToken } from "@/lib/api-client";
import type { TokenResponse } from "@/lib/types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

const STATS = [
  { icon: TrendingUpIcon, value: "91.2%",  label: "Auto-decision rate" },
  { icon: ZapIcon,        value: "<30s",   label: "Avg. processing time" },
  { icon: UsersIcon,      value: "7 roles", label: "RBAC access control" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const body = new URLSearchParams({ username, password });
      const { data } = await apiClient.post<TokenResponse>("/api/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      setToken(data.access_token);
      // Set session cookie for proxy route guard
      document.cookie = `cg_session=1; path=/; SameSite=Strict`;
      setIsSuccess(true);
      setTimeout(() => router.push("/dashboard"), 600);
    } catch {
      setError("Incorrect username or password.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh">

      {/* ── Left panel — hero image + brand overlay ── */}
      <div className="relative hidden w-[52%] lg:block overflow-hidden">

        {/* Full-bleed hero photo */}
        <Image
          src="/login-hero.jpg"
          alt="Insurance professional reviewing claims"
          fill
          className="object-cover object-center"
          priority
          sizes="52vw"
        />

        {/* Dark gradient overlay — heavier at top and bottom, lighter in middle */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />

        {/* Top — Logo */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2.5 p-8">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/95 shadow-lg">
            <ShieldCheckIcon className="size-5 text-slate-900" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">ClaimGuard</span>
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white/80 uppercase tracking-wide">
              v2
            </span>
          </div>
        </div>

        {/* Centre — headline copy */}
        <div className="absolute inset-0 z-10 flex flex-col items-start justify-center px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-400">
              AI-Powered Claims Intelligence
            </p>
            <h2 className="text-4xl font-bold leading-tight text-white max-w-xs">
              Detect fraud.<br />Decide faster.<br />Stay compliant.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/65 max-w-xs">
              Kenya's bancassurance-scale trust layer — combining machine learning,
              rules engines, and human review in one auditable platform.
            </p>
          </motion.div>
        </div>

        {/* Bottom — stat chips + feature list */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-8 space-y-4">

          {/* Stat chips */}
          <motion.div
            className="flex gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            {STATS.map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md"
              >
                <Icon className="size-3.5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-xs font-bold text-white">{value}</p>
                  <p className="text-[10px] text-white/55 leading-none mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Feature bullets */}
          <motion.div
            className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md space-y-2.5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {[
              "AI fraud scoring with full SHAP explainability",
              "Human-in-the-loop review queue with audit trail",
              "Motor, health & marine lines — IRA compliance built in",
            ].map((feat) => (
              <div key={feat} className="flex items-start gap-2.5">
                <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                <span className="text-xs text-white/70 leading-relaxed">{feat}</span>
              </div>
            ))}
          </motion.div>

        </div>
      </div>

      {/* ── Right panel — sign-in form ── */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <motion.div
          className="w-full max-w-sm"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Mobile logo */}
          <motion.div
            className="mb-8 flex flex-col items-center lg:hidden"
            variants={itemVariants}
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <ShieldCheckIcon className="size-6" />
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">ClaimGuard</p>
          </motion.div>

          {/* Heading */}
          <motion.div className="mb-8 text-center" variants={itemVariants}>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to your ClaimGuard account
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div variants={itemVariants}>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
                Username
              </label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <UserIcon className="size-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </InputGroup>
            </motion.div>

            <motion.div variants={itemVariants}>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <LockIcon className="size-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-3.5 text-muted-foreground" />
                    ) : (
                      <EyeIcon className="size-3.5 text-muted-foreground" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </motion.div>

            {error && (
              <motion.p variants={itemVariants} className="text-sm text-destructive">
                {error}
              </motion.p>
            )}

            <motion.div variants={itemVariants} className="pt-1">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading || isSuccess}
              >
                {isLoading ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckIcon className="size-4" />
                    <span>Success!</span>
                  </>
                ) : (
                  <span>Sign in</span>
                )}
              </Button>
            </motion.div>
          </form>

          {/* Security badge */}
          <motion.div
            className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50"
            variants={itemVariants}
          >
            <ShieldIcon className="size-3.5" />
            <span>256-bit SSL encrypted · ClaimGuard v2</span>
          </motion.div>
        </motion.div>
      </div>

    </div>
  );
}
