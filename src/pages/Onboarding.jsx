import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { avatarIcons } from "@/utils/customEmojis";
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
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      setUserEmail(user.email);
    };
    fetchUser();
  }, []);
  const [form, setForm] = useState({
    display_name: "",
    avatar_emoji: "🚀",
    zipcode: "",
    city: "",
    middle_school_name: "",
    high_school_name: "",
    current_grade: "",
    interests: [],
    strengths: [],
    preferred_learning_style: "",
    goals: [],
    dream_careers: [],
  });
  const [goalInput, setGoalInput] = useState("");
  const [careerInput, setCareerInput] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [strengthInput, setStrengthInput] = useState("");

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
    const goals = form.goals.length > 0 ? form.goals : ["Get into Good College"];
    const profile = await base44.entities.TeenProfile.create({
      ...form,
      goals,
      user_email: userEmail,
      onboarding_completed: true,
      account_created_date: new Date().toISOString(),
    });

    // Kick off recommendations and academic plan generation in background
    const cleanProfile = {
      user_email: userEmail,
      display_name: form.display_name,
      zipcode: form.zipcode,
      city: form.city,
      current_grade: form.current_grade,
      interests: form.interests,
      strengths: form.strengths,
      goals,
      dream_careers: form.dream_careers,
      preferred_learning_style: form.preferred_learning_style,
      middle_school_name: form.middle_school_name,
      high_school_name: form.high_school_name,
    };

    // Fire and forget both — don't await
    base44.functions.invoke('generateRecommendations', { profile: cleanProfile, existing_recommendations: [] }).catch(() => {});
    base44.functions.invoke('generateAcademicPlan', { profile: cleanProfile, journey: { adapt_mode: false } }).catch(() => {});

    setLoading(false);
    navigate("/");
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
    // Step 1: Name, Grade & Avatar
    () => (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Who are you?</h2>
          <p className="text-muted-foreground">Pick a name, grade, and avatar that represents you</p>
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
          <label className="text-sm font-medium mb-2 block">Your current grade</label>
          <Select value={String(form.current_grade || "")} onValueChange={v => setForm(p => ({ ...p, current_grade: parseInt(v) }))}>
            <SelectTrigger className="h-12 text-lg"><SelectValue placeholder="Select your grade" /></SelectTrigger>
            <SelectContent>
              {[7,8,9,10,11,12].map(g => (
                <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-3 block">Choose your avatar</label>
          <div className="grid grid-cols-6 gap-3">
              {AVATARS.map(emoji => {
                const Icon = avatarIcons[emoji];
                return (
                  <button
                    key={emoji}
                    onClick={() => setForm(p => ({ ...p, avatar_emoji: emoji }))}
                    className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 text-5xl shadow-sm hover:shadow-md",
                      form.avatar_emoji === emoji
                        ? "bg-gradient-to-br from-primary/20 to-primary/10 ring-2 ring-primary shadow-lg scale-110"
                        : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                    )}
                  >
                    {emoji}
                  </button>
                );
              })}
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
          <p className="text-xs text-destructive font-medium mt-1">* Zip code is required</p>
        </div>
        <SchoolSearch
          grade={form.current_grade || null}
          zipcode={form.zipcode}
          middleSchoolName={form.middle_school_name}
          highSchoolName={form.high_school_name}
          onZipChange={v => setForm(p => ({ ...p, zipcode: v }))}
          onMiddleSchoolChange={v => setForm(p => ({ ...p, middle_school_name: v }))}
          onHighSchoolChange={v => setForm(p => ({ ...p, high_school_name: v }))}
        />
      </div>
    ),
    // Step 3: Interests
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">What interests you?</h2>
          <p className="text-muted-foreground">Pick at least 3 things you're curious about</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add custom interest..."
            value={interestInput}
            onChange={e => setInterestInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addToList("interests", interestInput, setInterestInput)}
            className="h-11"
          />
          <Button onClick={() => addToList("interests", interestInput, setInterestInput)} variant="secondary" className="shrink-0">
            Add
          </Button>
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
        {(form.interests || []).filter(i => !INTERESTS.includes(i)).length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {(form.interests || []).filter(i => !INTERESTS.includes(i)).map((i, idx) => (
              <span key={idx} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm flex items-center gap-2">
                {i}
                <button onClick={() => removeFromList("interests", form.interests.indexOf(i))} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {form.interests.length} selected {form.interests.length < 3 && `(pick ${3 - form.interests.length} more)`}
        </p>
      </div>
    ),
    // Step 4: Strengths
    () => (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Your superpowers <span className="text-3xl">💪</span></h2>
          <p className="text-muted-foreground">What are you naturally good at?</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add custom strength..."
            value={strengthInput}
            onChange={e => setStrengthInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addToList("strengths", strengthInput, setStrengthInput)}
            className="h-11"
          />
          <Button onClick={() => addToList("strengths", strengthInput, setStrengthInput)} variant="secondary" className="shrink-0">
            Add
          </Button>
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
        {(form.strengths || []).filter(s => !STRENGTHS.includes(s)).length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {(form.strengths || []).filter(s => !STRENGTHS.includes(s)).map((s, idx) => (
              <span key={idx} className="px-3 py-1.5 bg-secondary/10 text-secondary rounded-lg text-sm flex items-center gap-2">
                {s}
                <button onClick={() => removeFromList("strengths", form.strengths.indexOf(s))} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    ),
    // Step 5: Learning Style
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
                "w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 shadow-sm hover:shadow-md",
                form.preferred_learning_style === value
                  ? "bg-primary/10 ring-2 ring-primary border border-primary shadow-md"
                  : "bg-white dark:bg-slate-800 border border-muted hover:border-primary"
              )}
            >
              <>
                <span className="text-4xl flex-shrink-0">{emoji}</span>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{value}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </>
            </button>
          ))}
        </div>
      </div>
    ),
    // Step 6: Goals & Dreams
    () => (
     <div className="space-y-6">
       <div className="text-center">
         <h2 className="font-heading text-2xl font-bold mb-2">Dream big! 🌟</h2>
         <p className="text-muted-foreground">What are your goals and dream careers? (Optional)</p>
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
      case 1: return form.display_name.trim() && form.current_grade;
      case 2: return form.zipcode.trim().length === 5; // zipcode required
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
                className="gap-2 bg-primary hover:bg-primary hover:bg-opacity-90 px-6"
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