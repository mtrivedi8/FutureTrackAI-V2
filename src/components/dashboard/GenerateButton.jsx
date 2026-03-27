import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = 'recs_generating';

export default function GenerateButton({ profile, existingRecs = [], onGenerated }) {
  const [loading, setLoading] = useState(() => !!localStorage.getItem(STORAGE_KEY));
  const pollRef = useRef(null);

  const startPolling = (prevCount) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const user = await base44.auth.me();
        const fresh = await base44.entities.Recommendation.filter({ user_email: user.email }, '-created_date', 100);
        if (fresh.length > prevCount) {
          clearInterval(pollRef.current);
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          toast.success(`${fresh.length - prevCount} new suggestions ready! 🎉`);
          onGenerated?.();
        }
      } catch (e) {
        clearInterval(pollRef.current);
        localStorage.removeItem(STORAGE_KEY);
        setLoading(false);
      }
    }, 4000);
  };

  // Resume polling if generation was in progress before navigation
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { prevCount } = JSON.parse(stored);
      startPolling(prevCount);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const generateRecommendations = async () => {
    if (!profile) return;
    const prevCount = existingRecs.length;
    setLoading(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ prevCount }));
    toast.info('Generating suggestions — you can browse other pages!');

    base44.functions.invoke('generateRecommendations', {
      profile,
      existingTitles: existingRecs.map(r => r.title),
    }).catch(err => console.error('generateRecommendations invoke error:', err));

    startPolling(prevCount);
  };

  return (
    <Button
      onClick={generateRecommendations}
      disabled={loading || !profile}
      className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          Get New Suggestions
        </>
      )}
    </Button>
  );
}