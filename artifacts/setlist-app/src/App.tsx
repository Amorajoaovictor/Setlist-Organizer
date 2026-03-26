import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { Header } from "@/components/Header";
import { AudioWaveform, LogIn } from "lucide-react";

import Setlists from "@/pages/Setlists";
import SetlistDetail from "@/pages/SetlistDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function LoginPage() {
  const { login } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-8 max-w-md text-center">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-primary">
          <AudioWaveform className="w-10 h-10" />
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Setlist<span className="text-primary">OS</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Organize your band's setlists, search songs via Spotify, and track total show duration.
          </p>
        </div>
        <button
          onClick={login}
          className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:opacity-90 transition-opacity"
        >
          <LogIn className="w-5 h-5" />
          Log in to get started
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Switch>
        <Route path="/" component={Setlists} />
        <Route path="/setlists/:id" component={SetlistDetail} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
