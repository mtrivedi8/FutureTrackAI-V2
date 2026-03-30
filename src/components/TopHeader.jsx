import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/recommendations": "Explore Paths",
  "/plan": "Academic Roadmap",
  "/journey": "My Journey",
  "/journey/new": "Add Entry",
  "/college-path": "College Path",
  "/profile": "Profile",
  "/progress": "Progress",
  "/membership": "Membership",
  "/roadmap": "Roadmap",
  "/thank-you": "Thank You",
};

// Root tab paths — no back button on these
const ROOT_PATHS = new Set(["/", "/recommendations", "/plan", "/journey", "/college-path", "/profile", "/progress", "/membership", "/roadmap"]);

export default function TopHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  // Only show on child routes (mobile)
  const isChild = !ROOT_PATHS.has(location.pathname);
  if (!isChild) return null;

  // Title: check exact match, then check dynamic routes
  let title = PAGE_TITLES[location.pathname];
  if (!title) {
    if (location.pathname.startsWith("/recommendations/")) title = location.state?.title || "Recommendation";
    else title = "Back";
  }

  return (
    <div className="md:hidden flex items-center gap-1 px-2 pt-3 pb-1 sticky top-0 bg-background/90 backdrop-blur-sm z-30 border-b border-border/50">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 p-2 -ml-1 rounded-xl text-primary active:bg-primary/10 transition-colors min-w-[44px] min-h-[44px] justify-center"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h2 className="font-heading font-semibold text-base text-foreground flex-1 truncate">{title}</h2>
    </div>
  );
}