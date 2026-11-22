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
import MemberDetail from "./pages/MemberDetail";
import BeforeAfter from "./pages/BeforeAfter";
import Profile from "./pages/Profile";
import Admin from "@/pages/Admin";
import Shop from "./pages/Shop";
import Decor from "./pages/Decor";
import Year from "./pages/Year";
import Itge from "./pages/Itge";
import Awards from "./pages/Awards";
import History from "./pages/History";
import { applyDecor, loadDecor } from "./lib/decor";
applyDecor(loadDecor());
import Invite from "@/pages/Invite";
import Ranking from "@/pages/Ranking";
import Reveal from "@/pages/Reveal";
import SeasonReport from "@/pages/SeasonReport";
import Archive from "@/pages/Archive";
import AwardApply from "@/pages/AwardApply";
import Events from "@/pages/Events";
import Feedback from "@/pages/Feedback";
import Apply from "@/pages/Apply";
import { useEffect } from "react";
import SignupFlow from "./components/SignupFlow";

function Router() {
  return (
    <Switch>
      {/* Invite route handles token capture before the user is signed in */}
      <Route path="/invite/:token">
        {(params) => <Invite token={params.token} />}
      </Route>

      {/* 2026-11-22: 방장용 가입 화면 미리보기 (저장 안 됨) */}
      <Route path="/preview/signup">
        <MembershipGate><SignupFlow preview /></MembershipGate>
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
              <Route path="/member/:id" component={MemberDetail} />
              <Route path="/before-after" component={BeforeAfter} />
              <Route path="/ranking" component={Ranking} />
              <Route path="/reveal" component={Reveal} />
              <Route path="/season-report" component={SeasonReport} />
              <Route path="/report" component={SeasonReport} />
              <Route path="/archive" component={Archive} />
              <Route path="/profile" component={Profile} />
              <Route path="/admin" component={Admin} />
          <Route path="/shop" component={Shop} />
          <Route path="/decor" component={Decor} />
          <Route path="/year" component={Year} />
          <Route path="/itge" component={Itge} />
          <Route path="/awards" component={Awards} />
          <Route path="/history" component={History} />
          <Route path="/award-apply" component={AwardApply} />
          <Route path="/events" component={Events} />
          <Route path="/feedback" component={Feedback} />
          <Route path="/apply" component={Apply} />
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
