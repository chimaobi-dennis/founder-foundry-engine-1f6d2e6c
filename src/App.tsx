import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { BrandProvider } from "@/hooks/use-brand";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <BrandProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
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
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </BrandProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
