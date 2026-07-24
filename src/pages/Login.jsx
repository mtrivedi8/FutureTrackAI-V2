import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, GraduationCap } from "lucide-react";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "sign_in") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMessage("Account created! Check your email to confirm, then sign in.");
        setMode("sign_in");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">FutureTrackAI</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your personalized career guide</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>}
          {message && <p className="text-sm text-primary bg-primary/10 rounded-lg p-3">{message}</p>}

          <Button type="submit" disabled={loading} className="w-full h-11 gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "sign_in" ? "Sign In" : "Create Account"}
          </Button>

          <button
            type="button"
            onClick={() => { setMode(mode === "sign_in" ? "sign_up" : "sign_in"); setError(null); setMessage(null); }}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === "sign_in" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
