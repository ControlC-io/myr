import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@shared/auth";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import InfoPage from "./pages/Dashboard";
import Home from "./pages/Home";
import TwoFactorChallenge from "./pages/TwoFactorChallenge";
import EmailOtpChallenge from "./pages/EmailOtpChallenge";
import Navbar from "./components/Navbar";
import DashboardHome from "./pages/DashboardHome";
import PlaceholderPage from "./pages/PlaceholderPage";
import TicketsPage from "./pages/TicketsPage";
import InvoicesPage from "./pages/InvoicesPage";
import InformationClient from "./pages/InformationClient";
import { ThemeProvider } from "./theme/ThemeProvider";

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <span className="text-sm text-textSecondary dark:text-textSecondary-dark">
          Checking session...
        </span>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login initialView="register" />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/2fa-challenge" element={<TwoFactorChallenge />} />
          <Route path="/auth/email-otp" element={<EmailOtpChallenge />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </main>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/service-status" element={<Home />} />
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route
            path="/interventions"
            element={<PlaceholderPage titleKey="pages.interventions.title" />}
          />
          <Route path="/facturation" element={<InvoicesPage />} />
          <Route
            path="/payment-information"
            element={<PlaceholderPage titleKey="pages.paymentInfo.title" />}
          />
          <Route
            path="/domiciliation-sepa"
            element={<PlaceholderPage titleKey="pages.sepa.title" />}
          />
          <Route
            path="/information-client"
            element={<InformationClient />}
          />
          <Route
            path="/reservation-salles-bcp"
            element={<PlaceholderPage titleKey="pages.bcpRooms.title" />}
          />
          <Route
            path="/suggestions"
            element={<PlaceholderPage titleKey="pages.suggestions.title" />}
          />
          <Route
            path="/offres"
            element={<PlaceholderPage titleKey="pages.offers.title" />}
          />
          <Route
            path="/commandes"
            element={<PlaceholderPage titleKey="pages.orders.title" />}
          />
          <Route
            path="/contrats"
            element={<PlaceholderPage titleKey="pages.contracts.title" />}
          />
          <Route
            path="/kyc"
            element={<PlaceholderPage titleKey="pages.kyc.title" />}
          />
          <Route
            path="/securite"
            element={<PlaceholderPage titleKey="pages.security.title" />}
          />
          <Route
            path="/ressources"
            element={<PlaceholderPage titleKey="pages.resources.title" />}
          />
          <Route
            path="/data-deletion"
            element={<PlaceholderPage titleKey="pages.dataDeletion.title" />}
          />
          <Route
            path="/commande-rapide"
            element={<PlaceholderPage titleKey="pages.quickOrder.title" />}
          />
          <Route path="/auth/2fa-challenge" element={<TwoFactorChallenge />} />
          <Route path="/auth/email-otp" element={<EmailOtpChallenge />} />
          {/* Redirect any unknown authenticated route back to the dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const queryClient = new QueryClient();

const App = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <div className="min-h-screen bg-background dark:bg-background-dark flex flex-col font-sans transition-colors duration-300">
              <AppRoutes />
            </div>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
