import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signIn, signUp } from "@/lib/supabase";

type Mode = "signin" | "signup";

export function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "signup") {
        const { error: err } = await signUp(email, password, fullName);
        if (err) throw err;
      } else {
        const { error: err } = await signIn(email, password);
        if (err) throw err;
      }
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4 bg-gradient-radial">
      <div className="w-full max-w-sm animate-fade_in">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-sora font-bold text-3xl text-text-primary tracking-tight">
            zab<span className="text-coral">eta</span>
          </h1>
          <p className="text-text-muted text-sm font-sans mt-2">
            Workforce operations platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-xl shadow-black/30">
          <h2 className="font-sora font-semibold text-text-primary text-lg mb-1">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-text-muted text-xs font-sans mb-5">
            {mode === "signin"
              ? "Sign in to your workspace"
              : "Join your team on Zabeta"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <Input
                id="fullName"
                label="Full name"
                type="text"
                placeholder="Alex Johnson"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            )}
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              error={error}
            />

            <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full mt-2">
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
              }}
              className="text-xs text-text-muted hover:text-coral transition-colors font-sans"
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="text-center text-text-disabled text-xs font-sans mt-6">
          By continuing, you agree to Zabeta's Terms of Service
        </p>
      </div>
    </div>
  );
}
