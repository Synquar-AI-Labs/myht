import { HouseholdProvider } from '@/hooks/HouseholdProvider';
import { HouseholdSetup } from '@/components/setup/HouseholdSetup';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RecordingProvider } from "@/hooks/RecordingProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh across screens and caregivers without hammering the API.
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <HouseholdProvider key={session.user.id} user={session.user}>
    <HouseholdSetup>{children}</HouseholdSetup>
  </HouseholdProvider>;
}
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Above the routes/tabs so an in-progress recording survives all
            in-app navigation. */}
        <RecordingProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RecordingProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
