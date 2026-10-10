import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrandProvider } from "@/hooks/use-brand";
import { ProductImagesProvider } from "@/hooks/use-product-images";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProfileProvider, useProfile } from "@/hooks/use-profile";
import { StudioSessionProvider } from "@/contexts/StudioSessionContext";
import { PricingModalProvider } from "@/contexts/PricingModalContext";
import { PricingModalPortal } from "@/components/billing/PricingModal";
import { Layout } from "./components/Layout";
import { AdminLayout } from "./components/admin/AdminLayout";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Philosophy from "./pages/Philosophy";
import System from "./pages/System";
import Journal from "./pages/Journal";
import Pricing from "./pages/Pricing";
import Memory from "./pages/Memory";
import Journey from "./pages/Journey";
import Mentor from "./pages/Mentor";
import ReelBuilder from "./pages/ReelBuilder";
import DocStudio from "./pages/DocStudio";
import ContentCalendar from "./pages/ContentCalendar";
import ProStudio from "./pages/ProStudio";
import ProStudioEditor from "./pages/ProStudioEditor";
import CampaignKit from "./pages/CampaignKit";
import CampaignDetail from "./pages/CampaignDetail";
import ContentStudio from "./pages/ContentStudio";
import ContentStudioNew from "./pages/ContentStudioNew";
import ContentStudioEditor from "./pages/ContentStudioEditor";
import Library from "./pages/Library";
import BrandDNA from "./pages/BrandDNA";
import SettingsAIModels from "./pages/SettingsAIModels";
import NotFound from "./pages/NotFound";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Onboarding from "./pages/Onboarding";
import Start from "./pages/Start";
import Work from "./pages/Work";
import CreatorApply from "./pages/CreatorApply";
import CreatorStudio from "./pages/CreatorStudio";
import CreatorTemplateEditor from "./pages/CreatorTemplateEditor";
import CreatorAgentEditor from "./pages/CreatorAgentEditor";
import Plan from "./pages/Plan";
import VariantStudio from "./pages/VariantStudio";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminAIModels from "./pages/admin/AdminAIModels";
import AdminKnowledgeBase from "./pages/admin/AdminKnowledgeBase";
import AdminJourneyStages from "./pages/admin/AdminJourneyStages";
import AdminErrorLogs from "./pages/admin/AdminErrorLogs";
import AdminRuntimeSettings from "./pages/admin/AdminRuntimeSettings";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminAgents from "./pages/admin/AdminAgents";
import Billing from "./pages/Billing";
import Studio from "./pages/Studio";
import LogoStudio from "./pages/LogoStudio";
import Team from "./pages/Team";
import AcceptInvite from "./pages/AcceptInvite";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();
  const authRoutes = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email"];
  const isAuthRoute = authRoutes.includes(location.pathname);
  const isPasswordRecovery = location.pathname === "/reset-password";
  const isOnboarding = location.pathname === "/start" || location.pathname === "/onboarding";
  const editorialPaths = ["/", "/philosophy", "/system", "/journal", "/pricing", "/memory", "/journey"];
  const isLanding = editorialPaths.includes(location.pathname);
  const isPublic = isLanding || isAuthRoute;

  if (isLoading || (session && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-4 h-4 rounded-full bg-primary animate-amber-pulse" />
      </div>
    );
  }

  if (!session && !isPublic) {
    // An invite link must survive the sign-in / sign-up detour.
    if (location.pathname.startsWith("/invite/")) {
      try { localStorage.setItem("kinika.pendingInvite", location.pathname); } catch { /* storage unavailable */ }
    }
    return <Navigate to="/sign-in" replace />;
  }

  if (session && isAuthRoute && !isPasswordRecovery) {
    let pendingInvite: string | null = null;
    try { pendingInvite = localStorage.getItem("kinika.pendingInvite"); } catch { /* storage unavailable */ }
    if (pendingInvite) {
      try { localStorage.removeItem("kinika.pendingInvite"); } catch { /* storage unavailable */ }
      return <Navigate to={pendingInvite} replace />;
    }
    if (profile && !profile.onboarding_completed) {
      return <Navigate to="/start" replace />;
    }
    return <Navigate to="/home" replace />;
  }

  if (session && profile && !profile.onboarding_completed && !isOnboarding && !isPublic) {
    return <Navigate to="/start" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <BrandProvider>
            <ProductImagesProvider>
              <StudioSessionProvider>
              <PricingModalProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AuthGuard>
                    <Routes>
                      <Route path="/" element={<Landing />} />
                      <Route path="/philosophy" element={<Philosophy />} />
                      <Route path="/system" element={<System />} />
                      <Route path="/journal" element={<Journal />} />
                      <Route path="/pricing" element={<Pricing />} />
                      <Route path="/memory" element={<Memory />} />
                      <Route path="/journey" element={<Journey />} />
                      <Route path="/sign-up" element={<SignUp />} />
                      <Route path="/sign-in" element={<SignIn />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/verify-email" element={<VerifyEmail />} />
                      <Route path="/start" element={<Start />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      {/* Admin shell — separate layout */}
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<AdminDashboard />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="product/templates" element={<AdminTemplates />} />
                        <Route path="product/applications" element={<AdminApplications />} />
                        <Route path="product/agents" element={<AdminAgents />} />
                        <Route path="product/ai-models" element={<AdminAIModels />} />
                        <Route path="knowledge-base" element={<AdminKnowledgeBase />} />
                        <Route path="journey-stages" element={<AdminJourneyStages />} />
                        <Route path="errors" element={<AdminErrorLogs />} />
                        <Route path="settings" element={<AdminRuntimeSettings />} />
                        <Route path="billing" element={<AdminBilling />} />
                      </Route>
                      {/* Main app shell */}
                      <Route element={<Layout />}>
                        {/* Editor routes — render inside Layout below top nav */}
                        <Route path="/pro-studio/editor" element={<ProStudioEditor />} />
                        <Route path="/content-studio/:briefId" element={<ContentStudioEditor />} />
                        <Route path="/home" element={<Home />} />
                        <Route path="/team" element={<Team />} />
                        <Route path="/plan" element={<Plan />} />
                        <Route path="/work/:taskId" element={<Work />} />
                        <Route path="/invite/:token" element={<AcceptInvite />} />
                        <Route path="/mentor/:brandId" element={<Mentor />} />
                        <Route path="/mentor" element={<Mentor />} />
                        <Route path="/pro-studio/:brandId" element={<ProStudio />} />
                        <Route path="/pro-studio" element={<ProStudio />} />
                        <Route path="/campaign-kit" element={<CampaignKit />} />
                        <Route path="/campaign-kit/:campaignId" element={<CampaignDetail />} />
                        <Route path="/studio" element={<Studio />} />
                        <Route path="/studio/logo" element={<LogoStudio />} />
                        <Route path="/content-studio" element={<ContentStudio />} />
                        <Route path="/content-studio/new" element={<ContentStudioNew />} />
                        <Route path="/content-calendar" element={<ContentCalendar />} />
                        <Route path="/content-calendar/:brandId" element={<ContentCalendar />} />
                        <Route path="/library" element={<Library />} />
                        <Route path="/library/:brandId" element={<Library />} />
                        <Route path="/doc-studio" element={<DocStudio />} />
                        <Route path="/doc-studio/:brandId" element={<DocStudio />} />
                        <Route path="/reel-builder" element={<ReelBuilder />} />
                        <Route path="/reel-builder/:brandId" element={<ReelBuilder />} />
                        <Route path="/brand-dna" element={<BrandDNA />} />
                        <Route path="/brand-dna/:brandId" element={<BrandDNA />} />
                        <Route path="/settings/ai-models" element={<SettingsAIModels />} />
                        <Route path="/billing" element={<Billing />} />
                        <Route path="/creator/apply" element={<CreatorApply />} />
                        <Route path="/creator" element={<CreatorStudio />} />
                        <Route path="/creator/agents/new" element={<CreatorAgentEditor />} />
                        <Route path="/creator/agents/:id" element={<CreatorAgentEditor />} />
                        <Route path="/creator/templates/new" element={<CreatorTemplateEditor />} />
                        <Route path="/creator/templates/:id" element={<CreatorTemplateEditor />} />
                        <Route path="/creator/templates/:templateId/variants/new" element={<VariantStudio />} />
                        <Route path="/creator/templates/:templateId/variants/:variantId" element={<VariantStudio />} />
                      </Route>
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AuthGuard>
                  <PricingModalPortal />
                </BrowserRouter>
              </TooltipProvider>
              </PricingModalProvider>
              </StudioSessionProvider>
            </ProductImagesProvider>
          </BrandProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
