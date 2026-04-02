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
import Breadcrumb from "./components/Breadcrumb";
import DashboardHome from "./pages/DashboardHome";
import PlaceholderPage from "./pages/PlaceholderPage";
import SepaPage from "./pages/SepaPage";
import PaymentInformationPage from "./pages/PaymentInformationPage";
import TicketsPage from "./pages/TicketsPage";
import InvoicesPage from "./pages/InvoicesPage";
import InformationClient from "./pages/InformationClient";
import OrdersPage from "./pages/OrdersPage";
import InterventionsPage from "./pages/InterventionsPage";
import BcpRoomsPage from "./pages/BcpRoomsPage";
import ResourcesPage from "./pages/ResourcesPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import OffresPage from "./pages/OffresPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import OfferDetailPage from "./pages/OfferDetailPage";
import ServicesPage from "./pages/ServicesPage";
import KycPage from "./pages/KycPage";
import MessagesPage from "./pages/MessagesPage";
import DataDeletionPage from "./pages/DataDeletionPage";
import NoAccessPage from "./pages/NoAccessPage";
import { ThemeProvider } from "./theme/ThemeProvider";
import { SupplierProvider, useSupplier } from "./context/SupplierContext";
import { PortalConfigProvider } from "./context/PortalConfigContext";
import PortalServiceGuard from "./components/PortalServiceGuard";
import ExternalRedirect from "./components/ExternalRedirect";
import { RoleGuard } from "./components/RoleGuard";
import { ROUTE_PERMISSIONS } from "./config/routePermissions";

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const { noAccess, loading: supplierLoading } = useSupplier();

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

  if (supplierLoading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <span className="text-sm text-textSecondary dark:text-textSecondary-dark">
          Loading...
        </span>
      </main>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Navbar />
      <Breadcrumb />
      <main className="flex-1">
        {noAccess ? (
          <NoAccessPage />
        ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/service-status" element={<Home />} />
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="/tickets" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/tickets']}><TicketsPage /></RoleGuard>} />
          <Route path="/tickets/:ticketId" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/tickets']}><TicketDetailPage /></RoleGuard>} />
          <Route path="/intervention" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/intervention']}><InterventionsPage /></RoleGuard>} />
          <Route path="/invoice" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/invoice']}><InvoicesPage /></RoleGuard>} />
          <Route path="/payment-information" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/payment-information']}><PaymentInformationPage /></RoleGuard>} />
          <Route path="/sepa" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/sepa']}><SepaPage /></RoleGuard>} />
          <Route path="/customer-information" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/customer-information']}><InformationClient /></RoleGuard>} />
          <Route
            path="/reservation-salles-bcp"
            element={
              <RoleGuard requiredRoles={ROUTE_PERMISSIONS['/reservation-salles-bcp']}>
                <PortalServiceGuard serviceKey="BCP">
                  <BcpRoomsPage />
                </PortalServiceGuard>
              </RoleGuard>
            }
          />
          <Route path="/suggestions" element={<SuggestionsPage />} />
          <Route path="/offer" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/offer']}><OffresPage /></RoleGuard>} />
          <Route path="/offer/:offerId" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/offer']}><OfferDetailPage /></RoleGuard>} />
          <Route path="/orders" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/orders']}><OrdersPage /></RoleGuard>} />
          <Route path="/orders/:orderId" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/orders']}><OrderDetailPage /></RoleGuard>} />
          <Route
            path="/services"
            element={
              <RoleGuard requiredRoles={ROUTE_PERMISSIONS['/services']}>
                <PortalServiceGuard serviceKey="Services">
                  <ServicesPage />
                </PortalServiceGuard>
              </RoleGuard>
            }
          />
          <Route
            path="/kyc"
            element={
              <RoleGuard requiredRoles={ROUTE_PERMISSIONS['/kyc']}>
                <PortalServiceGuard serviceKey="KYC">
                  <KycPage />
                </PortalServiceGuard>
              </RoleGuard>
            }
          />
          <Route path="/messages" element={<MessagesPage />} />
          <Route
            path="/securite"
            element={
              <RoleGuard requiredRoles={ROUTE_PERMISSIONS['/securite']}>
                <ExternalRedirect to="https://rcarre.appfarm.app/myrsecure" />
              </RoleGuard>
            }
          />
          <Route path="/ressources" element={<ResourcesPage />} />
          <Route path="/ressources/external-services" element={<ResourcesPage />} />
          <Route path="/data-deletion" element={<RoleGuard requiredRoles={ROUTE_PERMISSIONS['/data-deletion']}><DataDeletionPage /></RoleGuard>} />
          <Route
            path="/commande-rapide"
            element={
              <RoleGuard requiredRoles={ROUTE_PERMISSIONS['/commande-rapide']}>
                <PortalServiceGuard serviceKey="EasyOrdering">
                  <PlaceholderPage titleKey="pages.quickOrder.title" />
                </PortalServiceGuard>
              </RoleGuard>
            }
          />
          <Route path="/auth/2fa-challenge" element={<TwoFactorChallenge />} />
          <Route path="/auth/email-otp" element={<EmailOtpChallenge />} />
          {/* Redirect any unknown authenticated route back to the dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        )}
      </main>
    </div>
  );
};

const queryClient = new QueryClient();

const App = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <SupplierProvider>
              <PortalConfigProvider>
                <div className="min-h-screen bg-background dark:bg-background-dark flex flex-col font-sans transition-colors duration-300">
                  <AppRoutes />
                </div>
              </PortalConfigProvider>
            </SupplierProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
