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
import Home from "./pages/Home";
import Mentor from "./pages/Mentor";
import ReelBuilder from "./pages/ReelBuilder";
import DocStudio from "./pages/DocStudio";
import ContentCalendar from "./pages/ContentCalendar";
import ProStudio from "./pages/ProStudio";
import CampaignKit from "./pages/CampaignKit";
import Library from "./pages/Library";
import BrandDNA from "./pages/BrandDNA";
import NotFound from "./pages/NotFound";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import Onboarding from "./pages/Onboarding";
import CreatorApply from "./pages/CreatorApply";
import CreatorStudio from "./pages/CreatorStudio";
import CreatorTemplateEditor from "./pages/CreatorTemplateEditor";

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
    // Check if onboarding needed
    if (profile && !profile.onboarding_completed) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // Redirect to onboarding if not completed (and not already there)
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
                        <Route path="/creator/apply" element={<CreatorApply />} />
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
