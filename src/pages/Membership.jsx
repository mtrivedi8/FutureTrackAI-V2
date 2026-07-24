import { useState } from "react";
import { apiClient } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle, GraduationCap, Brain, BookOpen } from "lucide-react";

const features = [
  { icon: GraduationCap, text: "Personalized grade-by-grade academic roadmap" },
  { icon: Brain, text: "3 AI-generated career tracks tailored to your interests" },
  { icon: BookOpen, text: "Real course catalog data from your actual school" },
  { icon: Sparkles, text: "Extracurriculars, clubs & summer activity suggestions" },
];

export default function Membership() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    const response = await apiClient.functions.invoke('createCheckout', {});
    const { redirectUrl, error: err } = response.data;
    if (err || !redirectUrl) {
      setError(err || 'Failed to start checkout. Please try again.');
      setLoading(false);
      return;
    }
    window.location.href = redirectUrl;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Unlock Your Academic Plan</h1>
          <p className="text-muted-foreground mt-2">Get a personalized roadmap from your current grade to college</p>
        </div>

        {/* Pricing Card */}
        <div className="rounded-2xl border border-border bg-card shadow-xl p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-end justify-center gap-2">
              <span className="text-5xl font-heading font-bold text-foreground">$4.99</span>
              <span className="text-muted-foreground mb-2">/month</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground line-through">$9.99/month regular price</span>
              <span className="inline-block bg-accent/20 text-accent px-2.5 py-1 rounded-full text-xs font-semibold">Introductory</span>
            </div>
            <p className="text-sm text-muted-foreground">Up to 20 career plan generations per month — cancel anytime</p>
          </div>

          <div className="space-y-3">
            {features.map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-foreground">{text}</span>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive text-center bg-destructive/10 rounded-lg p-3">{error}</p>
          )}

          <Button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full h-12 text-base gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to checkout...</>
            ) : (
              <><CheckCircle className="w-5 h-5" /> Subscribe Now — $4.99/month</>
            )}
          </Button>

          <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground text-center space-y-1">
            <p>✅ Up to 20 AI career plan generations per month</p>
            <p>⚡ Usage resets every month automatically</p>
            <p>🔒 Secure payment powered by Stripe</p>
          </div>
        </div>
      </div>
    </div>
  );
}