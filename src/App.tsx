import { HouseholdProvider } from '@/hooks/HouseholdProvider';
import { useHousehold } from '@/hooks/HouseholdProvider';
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
import { AppUpdate } from '@/components/AppUpdate';
import { isNativeApp } from '@/native/platform';
import { NativeUpdateGate } from '@/components/NativeUpdateGate';
import { ExerciseTimerProvider } from '@/hooks/ExerciseTimerProvider';

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
function HouseholdRecording({ children }: { children: React.ReactNode }) {
  const { user, householdId } = useHousehold();
  return <RecordingProvider key={user.id + ':' + householdId}><ExerciseTimerProvider key={user.id + ':' + householdId}>{children}</ExerciseTimerProvider></RecordingProvider>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  const household = <HouseholdProvider key={session.user.id} user={session.user}>
    <HouseholdSetup><HouseholdRecording>{children}</HouseholdRecording></HouseholdSetup>
  </HouseholdProvider>;
  return isNativeApp() ? <NativeUpdateGate key={session.user.id}>{household}</NativeUpdateGate> : household;
}
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {!isNativeApp() && <AppUpdate />}
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
