import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { PhoneShell } from "./components/PhoneShell";
import { DesktopShell } from "./components/DesktopShell";
import SignInPage from "./pages/SignInPage";
import DashboardPage from "./pages/DashboardPage";
import TransferPage from "./pages/TransferPage";
import TransferReceiptPage from "./pages/TransferReceiptPage";
import PaymentsPage from "./pages/PaymentsPage";
import HistoryPage from "./pages/HistoryPage";
import TxnHeldPage from "./pages/TxnHeldPage";
import FreezeDisputePage from "./pages/FreezeDisputePage";
import CardsPage from "./pages/CardsPage";
import ProfileDevicesPage from "./pages/ProfileDevicesPage";
import NotificationsPage from "./pages/NotificationsPage";
import OnboardingPage from "./pages/OnboardingPage";
import LoanPage from "./pages/LoanPage";
import OpsConsolePage from "./pages/OpsConsolePage";
import LoanOfficerPage from "./pages/LoanOfficerPage";
import DisputeOfficerPage from "./pages/DisputeOfficerPage";
import KycOfficerPage from "./pages/KycOfficerPage";
import AuditTrailPage from "./pages/AuditTrailPage";
import UssdAgentPage from "./pages/UssdAgentPage";
import LandingPage from "./pages/LandingPage";
import StaffSignInPage from "./pages/StaffSignInPage";

function Private({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

function OpsPrivate({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  if (!token || user?.role !== "OFFICER") {
    return <Navigate to="/ops/signin" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<PhoneShell><OnboardingPage /></PhoneShell>} />
      <Route path="/signin" element={<PhoneShell><SignInPage /></PhoneShell>} />
      <Route path="/ops/signin" element={<StaffSignInPage />} />
      <Route path="/ussd" element={<UssdAgentPage />} />

      <Route
        path="/app"
        element={
          <Private>
            <PhoneShell showTabbar />
          </Private>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="transfer" element={<TransferPage />} />
        <Route path="transfer/receipt/:id" element={<TransferReceiptPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="held/:id" element={<TxnHeldPage />} />
        <Route path="security" element={<FreezeDisputePage />} />
        <Route path="cards" element={<CardsPage />} />
        <Route path="profile" element={<ProfileDevicesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="loans" element={<LoanPage />} />
      </Route>

      <Route
        path="/ops"
        element={
          <OpsPrivate>
            <DesktopShell />
          </OpsPrivate>
        }
      >
        <Route index element={<OpsConsolePage />} />
        <Route path="kyc" element={<KycOfficerPage />} />
        <Route path="disputes" element={<DisputeOfficerPage />} />
        <Route path="loans" element={<LoanOfficerPage />} />
        <Route path="audit" element={<AuditTrailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
