import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = 'recs_generating';

export default function GenerateButton({ profile, existingRecs = [], onGenerated, onNewRec }) {
  const [loading, setLoading] = useState(() => !!localStorage.getItem(STORAGE_KEY));
  const pollRef = useRef(null);
  const lastCountRef = useRef(existingRecs.length);

  const startPolling = (prevCount) => {
    if (pollRef.current) clearInterval(pollRef.current);
    lastCountRef.current = prevCount;
    let stableRounds = 0;
    pollRef.current = setInterval(async () => {
      try {
        const user = await base44.auth.me();
        const fresh = await base44.entities.Recommendation.filter({ user_email: user.email }, '-created_date', 100);
        if (fresh.length > lastCountRef.current) {
          // New recs arrived — show them immediately
          onNewRec?.(fresh);
          lastCountRef.current = fresh.length;
          stableRounds = 0;
        } else {
          stableRounds++;
        }
        // Stop after 2 stable rounds (no new recs) or if we've accumulated 5+ new recs
        const totalNew = fresh.length - prevCount;
        if (stableRounds >= 2 || totalNew >= 5) {
          clearInterval(pollRef.current);
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          if (totalNew > 0) toast.success(`${totalNew} new suggestions ready! 🎉`);
          onGenerated?.();
        }
      } catch (e) {
        clearInterval(pollRef.current);
        localStorage.removeItem(STORAGE_KEY);
        setLoading(false);
      }
    }, 3000);
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