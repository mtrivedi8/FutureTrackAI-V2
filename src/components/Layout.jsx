import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import TopHeader from "./TopHeader";
import { AnimatePresence } from "framer-motion";
import PageTransition from "./PageTransition";
import { Home, Compass, TrendingUp, User, BookOpen, Trophy, GraduationCap, Briefcase, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { path: "/", icon: Home, label: "Dashboard" },
  { path: "/recommendations", icon: Compass, label: "Explore" },
  { path: "/plan", icon: BookOpen, label: "Roadmap" },
  { path: "/internships", icon: Briefcase, label: "Internships" },
  { path: "/journey", icon: Trophy, label: "Journey" },
  { path: "/college-path", icon: GraduationCap, label: "College Path" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (location.pathname === "/onboarding") {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r border-border bg-card z-40">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg text-foreground">FutureTrackAI</h1>
              <p className="text-xs text-muted-foreground">Your career guide</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            );
          })}
        </nav>
        {user?.role === 'admin' && (
          <div className="px-3 pb-2">
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                location.pathname === "/admin"
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <ShieldAlert className="w-5 h-5" />
              Admin
            </Link>
          </div>
        )}
        <div className="p-4">
          <div className="rounded-xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-4">
            <p className="text-xs font-medium text-foreground mb-1">Pro Tip 💡</p>
            <p className="text-xs text-muted-foreground">Log your journey entries to get better roadmap & suggestions!</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0 safe-area-top">
        <TopHeader />
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border z-40 safe-area-bottom select-none">
        <div className="flex items-center justify-around py-1 px-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "flex flex-col items-center gap-1 min-w-[48px] min-h-[48px] px-3 py-2 rounded-xl transition-all duration-200 select-none justify-center",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "scale-110")} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}