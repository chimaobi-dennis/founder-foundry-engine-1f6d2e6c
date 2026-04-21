import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { BrandProvider } from "@/hooks/use-brand";
import { ProductImagesProvider } from "@/hooks/use-product-images";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProfileProvider, useProfile } from "@/hooks/use-profile";
import { Layout } from "./components/Layout";
import { AdminLayout } from "./components/admin/AdminLayout";
import Home from "./pages/Home";
import Mentor from "./pages/Mentor";
import ReelBuilder from "./pages/ReelBuilder";
import DocStudio from "./pages/DocStudio";
import ContentCalendar from "./pages/ContentCalendar";
import ProStudio from "./pages/ProStudio";
import CampaignKit from "./pages/CampaignKit";
import Library from "./pages/Library";
import BrandDNA from "./pages/BrandDNA";
import SettingsAIModels from "./pages/SettingsAIModels";
import NotFound from "./pages/NotFound";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import Onboarding from "./pages/Onboarding";
import CreatorApply from "./pages/CreatorApply";
import CreatorStudio from "./pages/CreatorStudio";
import CreatorTemplateEditor from "./pages/CreatorTemplateEditor";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminAIModels from "./pages/admin/AdminAIModels";
import AdminKnowledgeBase from "./pages/admin/AdminKnowledgeBase";
import AdminJourneyStages from "./pages/admin/AdminJourneyStages";
import AdminErrorLogs from "./pages/admin/AdminErrorLogs";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();
  const isAuthRoute = location.pathname === "/sign-in" || location.pathname === "/sign-up";
  const isOnboarding = location.pathname === "/onboarding";

  if (isLoading || (session && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-4 h-4 rounded-full bg-primary animate-amber-pulse" />
      </div>
    );
  }

  if (!session && !isAuthRoute) {
    return <Navigate to="/sign-in" replace />;
  }

  if (session && isAuthRoute) {
    if (profile && !profile.onboarding_completed) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/" replace />;
  }

  if (session && profile && !profile.onboarding_completed && !isOnboarding && !isAuthRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <BrandProvider>
            <ProductImagesProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AuthGuard>
                    <Routes>
                      <Route path="/sign-up" element={<SignUp />} />
                      <Route path="/sign-in" element={<SignIn />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      {/* Admin shell — separate layout */}
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<AdminDashboard />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="product/templates" element={<AdminTemplates />} />
                        <Route path="product/applications" element={<AdminApplications />} />
                        <Route path="product/ai-models" element={<AdminAIModels />} />
                        <Route path="knowledge-base" element={<AdminKnowledgeBase />} />
                        <Route path="journey-stages" element={<AdminJourneyStages />} />
                        <Route path="errors" element={<AdminErrorLogs />} />
                      </Route>
                      {/* Main app shell */}
                      <Route element={<Layout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/mentor" element={<Mentor />} />
                        <Route path="/pro-studio" element={<ProStudio />} />
                        <Route path="/campaign-kit" element={<CampaignKit />} />
                        <Route path="/content-calendar" element={<ContentCalendar />} />
                        <Route path="/library" element={<Library />} />
                        <Route path="/doc-studio" element={<DocStudio />} />
                        <Route path="/reel-builder" element={<ReelBuilder />} />
                        <Route path="/brand-dna" element={<BrandDNA />} />
                        <Route path="/settings/ai-models" element={<SettingsAIModels />} />
                        <Route path="/creator/apply" element={<CreatorApply />} />
                        <Route path="/creator" element={<CreatorStudio />} />
                        <Route path="/creator/templates/new" element={<CreatorTemplateEditor />} />
                        <Route path="/creator/templates/:id" element={<CreatorTemplateEditor />} />
                      </Route>
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AuthGuard>
                </BrowserRouter>
              </TooltipProvider>
            </ProductImagesProvider>
          </BrandProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
