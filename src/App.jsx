import { Toaster } from "@/components/ui/toaster"
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Recommendations from './pages/Recommendations';
import Progress from './pages/Progress';
import Profile from './pages/Profile';
import AcademicPlan from './pages/AcademicPlan';
import Membership from './pages/Membership';
import ThankYou from './pages/ThankYou';
import RoadmapDemo from './pages/RoadmapDemo';
import CollegePath from './pages/CollegePath';
import Journey from './pages/Journey';
import RecommendationDetailPage from './pages/RecommendationDetailPage';
import JourneyNewPage from './pages/JourneyNewPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // For auth_required, don't redirect — let the app render and individual pages handle auth
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/plan" element={<AcademicPlan />} />
        <Route path="/membership" element={<Membership />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/college-path" element={<CollegePath />} />
        <Route path="/journey" element={<Journey />} />
        <Route path="/journey/new" element={<JourneyNewPage />} />
        <Route path="/recommendations/:id" element={<RecommendationDetailPage />} />
        <Route path="/roadmap" element={<RoadmapDemo />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e) => document.documentElement.classList.toggle('dark', e.matches);
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App