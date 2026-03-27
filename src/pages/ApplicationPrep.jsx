import { Rocket } from "lucide-react";

export default function ApplicationPrep() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
        <Rocket className="w-10 h-10 text-primary" />
      </div>
      <h1 className="font-heading text-3xl font-bold text-foreground mb-3">Application Prep</h1>
      <p className="text-muted-foreground text-lg">Coming soon! We're building something great.</p>
    </div>
  );
}