import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ArrowRight, ArrowLeft, Rocket, Star, Zap, Heart, School } from "lucide-react";
import SchoolSearch from "@/components/profile/SchoolSearch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const INTERESTS = [
  "Technology", "Art & Design", "Science", "Music", "Sports", "Writing",
  "Gaming", "Environment", "Business", "Medicine", "Education", "Film & Media",
  "Cooking", "Fashion", "Engineering", "Social Impact", "Math", "Photography"
];

const STRENGTHS = [
  "Problem Solving", "Creativity", "Leadership", "Communication", "Teamwork",
  "Analytical Thinking", "Empathy", "Organization", "Public Speaking",
  "Adaptability", "Persistence", "Curiosity"
];

const LEARNING_STYLES = [
  { value: "Visual", emoji: "👁️", desc: "I learn by seeing" },
  { value: "Hands-on", emoji: "🛠️", desc: "I learn by doing" },
  { value: "Reading", emoji: "📚", desc: "I learn by reading" },
  { value: "Social", emoji: "👥", desc: "I learn with others" },
  { value: "Mixed", emoji: "🎯", desc: "A mix of everything" },
];

const AVATARS = ["🚀", "🌟", "🎨", "🔬", "🎵", "⚡", "🌍", "💡", "🎮", "🦋", "🔥", "🌈"];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    age: "",
    avatar_emoji: "🚀",
    zipcode: "",
    city: "",
    school_name: "",
    current_grade: "",
    interests: [],
    strengths: [],
    preferred_learning_style: "",
    goals: [],
    dream_careers: [],
  });
  const [goalInput, setGoalInput] = useState("");
  const [careerInput, setCareerInput] = useState("");

  const toggleItem = (field, item) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }));
  };

  const addToList = (field, value, setter) => {
    if (value.trim()) {
      setForm(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }));
      setter("");
    }
  };

  const removeFromList = (field, index) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    await base44.entities.TeenProfile.create({
      ...form,
      user_email: user.email,
      age: parseInt(form.age) || 0,
      onboarding_completed: true,
    });
    setLoading(false);
    navigate("/recommendations");
  };

  const steps = [
    // Step 0: Welcome
    () => (
      <div className="flex flex-col items-center text-center space-y-8">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-24 h-24 rounded-3xl shadow-2xl shadow-primary/30 overflow-hidden"
        >
          <img src="https://media.base44.com/images/public/69c463e044e3d6bf7ee94b35/6d1d181d6_Gemini_Generated_Image_5itd815itd815itd.png" alt="FutureTrackAI" className="w-full h-full object-cover" />
        </motion.div>
        <div>
          <h1 className="font-heading text-4xl font-bold text-foreground mb-3">
            Welcome to FutureTrackAI
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Your personal AI mentor for exploring careers and building skills. Let's discover what makes you unique! ✨
          </p>
        </div>
        <div className="flex gap-6 text-center">
          {[
            { icon: Star, text: "Discover", color: "text-primary" },
            { icon: Zap, text: "Learn", color: "text-secondary" },
            { icon: Rocket, text: "Grow", color: "text-accent" },
          ].map(({ icon: Icon, text, color }) => (
            <div key={text} className="flex flex-col items-center gap-2">
              <div className={cn("w-12 h-12 rounded-2xl bg-muted flex items-center justify-center", color)}>
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    // Step 1: Name & Avatar
    () => (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Who are you?</h2>
          <p className="text-muted-foreground">Pick a name and avatar that represents you</p>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Your name</label>
          <Input
            placeholder="What should we call you?"
            value={form.display_name}
            onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
            className="h-12 text-lg"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Your age</label>
          <Input
            type="number"
            placeholder="How old are you?"
            value={form.age}
            onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
            className="h-12 text-lg"
            min={10}
            max={19}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-3 block">Choose your avatar</label>
          <div className="grid grid-cols-6 gap-3">
            {AVATARS.map(emoji => (
              <button
                key={emoji}
                onClick={() => setForm(p => ({ ...p, avatar_emoji: emoji }))}
                className={cn(
                  "w-14 h-14 rounded-2xl text-2xl flex items-center justify-center transition-all duration-200",
                  form.avatar_emoji === emoji
                    ? "bg-primary/15 ring-2 ring-primary scale-110"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
    // Step 2: School Info
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Your school 🏫</h2>
          <p className="text-muted-foreground">Enter your zip code and we'll find real courses from your school</p>
        </div>
        <div className="space-y-4">
          <SchoolSearch
            zipcode={form.zipcode}
            schoolName={form.school_name}
            onZipChange={v => setForm(p => ({ ...p, zipcode: v }))}
            onSchoolChange={v => setForm(p => ({ ...p, school_name: v }))}
          />
          <div>
            <label className="text-sm font-medium mb-2 block">Current grade</label>
            <Select value={String(form.current_grade || "")} onValueChange={v => setForm(p => ({ ...p, current_grade: parseInt(v) }))}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select your grade" /></SelectTrigger>
              <SelectContent>
                {[7,8,9,10,11,12].map(g => (
                  <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    ),
    // Step 3: Interests
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">What interests you?</h2>
          <p className="text-muted-foreground">Pick at least 3 things you're curious about</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {INTERESTS.map(interest => (
            <button
              key={interest}
              onClick={() => toggleItem("interests", interest)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                form.interests.includes(interest)
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {interest}
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {form.interests.length} selected {form.interests.length < 3 && `(pick ${3 - form.interests.length} more)`}
        </p>
      </div>
    ),
    // Step 3: Strengths
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Your superpowers 💪</h2>
          <p className="text-muted-foreground">What are you naturally good at?</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {STRENGTHS.map(s => (
            <button
              key={s}
              onClick={() => toggleItem("strengths", s)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                form.strengths.includes(s)
                  ? "bg-secondary text-secondary-foreground shadow-lg shadow-secondary/25 scale-105"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    ),
    // Step 4: Learning Style
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">How do you learn best?</h2>
          <p className="text-muted-foreground">Pick the style that suits you most</p>
        </div>
        <div className="space-y-3">
          {LEARNING_STYLES.map(({ value, emoji, desc }) => (
            <button
              key={value}
              onClick={() => setForm(p => ({ ...p, preferred_learning_style: value }))}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200",
                form.preferred_learning_style === value
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              <span className="text-3xl">{emoji}</span>
              <div>
                <p className="font-medium text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    ),
    // Step 5: Goals & Dreams
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Dream big! 🌟</h2>
          <p className="text-muted-foreground">What are your goals and dream careers?</p>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Your goals</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Learn to code, Start a business..."
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addToList("goals", goalInput, setGoalInput)}
              className="h-11"
            />
            <Button onClick={() => addToList("goals", goalInput, setGoalInput)} variant="secondary" className="shrink-0">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {form.goals.map((g, i) => (
              <span key={i} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm flex items-center gap-2">
                {g}
                <button onClick={() => removeFromList("goals", i)} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Dream careers</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Software Engineer, Doctor, Artist..."
              value={careerInput}
              onChange={e => setCareerInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addToList("dream_careers", careerInput, setCareerInput)}
              className="h-11"
            />
            <Button onClick={() => addToList("dream_careers", careerInput, setCareerInput)} variant="secondary" className="shrink-0">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {form.dream_careers.map((c, i) => (
              <span key={i} className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-sm flex items-center gap-2">
                {c}
                <button onClick={() => removeFromList("dream_careers", i)} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
  ];

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return form.display_name.trim() && form.age;
      case 2: return true; // school info optional
      case 3: return form.interests.length >= 3;
      case 4: return form.strengths.length >= 1;
      case 5: return form.preferred_learning_style;
      case 6: return true;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-secondary to-accent"
          animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {steps[step]()}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-10">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            ) : <div />}
            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="gap-2 bg-primary hover:bg-primary/90 px-6"
              >
                {step === 0 ? "Let's Go" : "Next"} <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 px-8"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Launch My Journey <Rocket className="w-4 h-4" /></>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}