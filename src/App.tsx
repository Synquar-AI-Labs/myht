import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
  const { session, loading, signOut } = useAuth();
  const [approval, setApproval] = useState<{ userId: string; allowed: boolean } | null>(null);
  const userId = session?.user.id;
  useEffect(() => {
    let cancelled = false;
    setApproval(null);
    if (userId) {
      (async () => {
        let allowed = true;
        try {
          const { data, error } = await (supabase as any).rpc('is_allowed_user');
          allowed = !!error || data !== false;
        } catch { /* Preserve access if the migration/RPC is unavailable. */ }
        if (!cancelled) setApproval({ userId, allowed });
      })();
    }
    return () => { cancelled = true; };
  }, [userId]);
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (approval?.userId === userId && approval?.allowed === false) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p>This account isn't approved yet.</p>
      <p>Ask the person who manages this app to approve {session.user.email}.</p>
      <Button onClick={signOut}>Sign out</Button>
    </div>
  );
  return <>{children}</>;
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
