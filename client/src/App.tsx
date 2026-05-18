import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import MembershipGate from "./components/MembershipGate";
import AppLayout from "./components/AppLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Today from "./pages/Today";
import Feed from "./pages/Feed";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Profile from "./pages/Profile";
import Admin from "@/pages/Admin";
import Invite from "@/pages/Invite";
import Ranking from "@/pages/Ranking";
import Reveal from "@/pages/Reveal";
import SeasonReport from "@/pages/SeasonReport";
import Archive from "@/pages/Archive";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      {/* Invite route handles token capture before the user is signed in */}
      <Route path="/invite/:token">
        {(params) => <Invite token={params.token} />}
      </Route>

      <Route>
        <MembershipGate>
          <AppLayout>
            <Switch>
              <Route path="/" component={Today} />
              <Route path="/today" component={Today} />
              <Route path="/feed" component={Feed} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/members" component={Members} />
              <Route path="/ranking" component={Ranking} />
              <Route path="/reveal" component={Reveal} />
              <Route path="/season-report" component={SeasonReport} />
              <Route path="/report" component={SeasonReport} />
              <Route path="/archive" component={Archive} />
              <Route path="/profile" component={Profile} />
              <Route path="/admin" component={Admin} />
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </MembershipGate>
      </Route>
    </Switch>
  );
}

function App() {
  // Fix mobile vh
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
