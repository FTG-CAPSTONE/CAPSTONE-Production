"use client";

import { useState } from "react";
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
      // Set a lightweight session cookie so proxy.ts can gate dashboard routes
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
      {/* Left panel — brand */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-zinc-950 lg:flex">
        {/* Logo */}
        <div className="relative z-20 flex items-center gap-2.5 p-8">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white text-black">
            <ShieldCheckIcon className="size-4" />
          </div>
          <span className="text-sm font-semibold text-white">ClaimGuard</span>
        </div>

        {/* Centre graphic */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 opacity-10">
            <ShieldCheckIcon className="size-48 text-white" strokeWidth={0.5} />
          </div>
        </div>

        {/* Feature list */}
        <div className="relative z-20 mt-auto p-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm space-y-3">
            {[
              "AI-powered fraud detection & risk scoring",
              "Real-time claims analytics & decision support",
              "Human-in-the-loop review workflow",
            ].map((feat) => (
              <div key={feat} className="flex items-start gap-2.5">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <span className="text-sm text-white/70">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
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
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheckIcon className="size-5" />
            </div>
          </motion.div>

          {/* Heading */}
          <motion.div className="text-center" variants={itemVariants}>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to your ClaimGuard account
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
              <motion.p
                variants={itemVariants}
                className="text-sm text-destructive"
              >
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

          {/* Secured badge */}
          <motion.div
            className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60"
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
