import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Compass, TrendingUp, User, GraduationCap, Rocket, BarChart2, Map, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/recommendations", icon: Compass, label: "Explore" },
  { path: "/plan", icon: GraduationCap, label: "My Plan" },
  { path: "/path-demo", icon: Map, label: "Path Demo" },
  { path: "/roadmap", icon: GitBranch, label: "Roadmap" },
  { path: "/progress", icon: TrendingUp, label: "Journey" },
  { path: null, icon: BarChart2, label: "Track Progress" },
  { path: "/application-prep", icon: Rocket, label: "Application Prep" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function Layout() {
  const location = useLocation();

  if (location.pathname === "/onboarding") {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r border-border bg-card z-40">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden">
              <img src="https://media.base44.com/images/public/69c463e044e3d6bf7ee94b35/5913825d1_Gemini_Generated_Image_5itd815itd815itd.png" alt="FutureTrackAI" className="w-full h-full object-cover" />
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
            if (!path) {
              return (
                <button
                  key={label}
                  onClick={() => toast.info('Personalize your Progress to help you with future College Application. Start early. Stay intentional. Turn potential into a story colleges can\'t ignore.')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted w-full text-left"
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              );
            }
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
        <div className="p-4">
          <div className="rounded-xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-4">
            <p className="text-xs font-medium text-foreground mb-1">Pro Tip 💡</p>
            <p className="text-xs text-muted-foreground">Log your progress regularly to get better recommendations!</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border z-40 safe-area-bottom">
        <div className="flex items-center justify-around py-2 px-4">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            if (!path) {
              return (
                <button
                  key={label}
                  onClick={() => toast.info('Personalize your Progress to help you with future College Application. Start early. Stay intentional. Turn potential into a story colleges can\'t ignore.')}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 text-muted-foreground"
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Track</span>
                </button>
              );
            }
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "scale-110")} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}