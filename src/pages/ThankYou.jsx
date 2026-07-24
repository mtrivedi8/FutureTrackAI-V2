import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, GraduationCap } from "lucide-react";

export default function ThankYou() {
  const [checking, setChecking] = useState(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const check = async () => {
      const user = await apiClient.auth.me();
      const memberships = await apiClient.entities.Membership.filter({ user_email: user.email, status: "active" });
      setActive(memberships.length > 0);
      setChecking(false);
    };

    // Poll a few times to wait for webhook
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const user = await apiClient.auth.me();
      const memberships = await apiClient.entities.Membership.filter({ user_email: user.email, status: "active" });
      if (memberships.length > 0 || attempts >= 8) {
        setActive(memberships.length > 0);
        setChecking(false);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-md w-full text-center space-y-6">
        {checking ? (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h1 className="font-heading text-2xl font-bold">Confirming your payment...</h1>
            <p className="text-muted-foreground">Please wait a moment while we activate your membership.</p>
          </>
        ) : active ? (
          <>
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-foreground">You're all set! 🎉</h1>
            <p className="text-muted-foreground">Your membership is active. Go generate your personalized academic roadmap now!</p>
            <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Link to="/plan"><GraduationCap className="w-5 h-5" /> Generate My Plan</Link>
            </Button>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Payment received!</h1>
            <p className="text-muted-foreground">Your membership is being activated. It may take a minute — check back shortly.</p>
            <Button asChild variant="outline">
              <Link to="/plan">Go to Academic Plan</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}