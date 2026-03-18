import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { getJson } from "../api/client";
import { useInterventions } from "../features/interventions/hooks";
import MonthCalendar from "../components/MonthCalendar";

type Tab = "list" | "calendar";

interface OrgsResponse {
  organizations: { id: string }[];
}

const InterventionsPage = () => {
  const { t } = useTranslation("common");
  const { jwtToken, loading: authLoading, jwtLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function fetchOrg() {
      if (authLoading || jwtLoading) return;

      if (!jwtToken) {
        setOrgError("No JWT token available. Please log out and log in again.");
        return;
      }

      try {
        setOrgError(null);
        const { organizations } = await getJson<OrgsResponse>(
          "/orgs/mine",
          undefined,
          { Authorization: `Bearer ${jwtToken}` },
        );

        if (organizations.length === 0) {
          setOrgError("No organization found for the current user.");
          return;
        }

        setOrgId(organizations[0].id);
      } catch (err: any) {
        const status =
          typeof err === "object" && err && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;

        if (status === 401) {
          setOrgError("Your session is not authorized. Please sign in again.");
        } else if (status === 403) {
          setOrgError("Organization access denied for this account.");
        } else if (status === 502) {
          setOrgError(
            "Unable to reach the external data service. Please contact your administrator.",
          );
        } else {
          setOrgError(
            err.message || "An error occurred while fetching your organization.",
          );
        }
      }
    }

    fetchOrg();
  }, [jwtToken, authLoading, jwtLoading]);

  const { data, isLoading, isError, error, refetch } = useInterventions({
    orgId: orgId ?? "",
    dateBegin: `>${today}`,
  });

  const total = data?.intervention?.total ?? null;

  if (authLoading || jwtLoading || (orgId === null && !orgError)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark"></div>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="flex-1 p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {orgError}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark">
          {t("pages.interventions.title")}
          {total !== null && (
            <span className="ml-3 text-base font-medium text-textSecondary dark:text-textSecondary-dark">
              ({total})
            </span>
          )}
        </h1>

        <div className="flex gap-8 border-b border-border/20 dark:border-border-dark/20 justify-center">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`pb-3 text-sm font-bold tracking-wide transition-colors ${
              activeTab === "list"
                ? "text-pink border-b-2 border-pink"
                : "text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark"
            }`}
          >
            {t("pages.interventions.tabs.list")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`pb-3 text-sm font-bold tracking-wide transition-colors ${
              activeTab === "calendar"
                ? "text-pink border-b-2 border-pink"
                : "text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark"
            }`}
          >
            {t("pages.interventions.tabs.calendar")}
          </button>
        </div>

        {activeTab === "list" ? (
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
            {isLoading && (
              <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                {t("placeholders.loading")}
              </div>
            )}

            {isError && (
              <div className="p-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
                  <p>{t("errors.generic", "There was a problem loading interventions")}</p>
                  <p className="text-xs opacity-80 mt-1">
                    {error instanceof Error ? error.message : String(error)}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs underline"
                    onClick={() => refetch()}
                  >
                    {t("actions.retry", "Try again")}
                  </button>
                </div>
              </div>
            )}

            {!isLoading && !isError && total === null && (
              <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                {t("pages.interventions.empty")}
              </div>
            )}

            {!isLoading && !isError && total !== null && (
              <div className="py-16 text-center space-y-2">
                <p className="text-5xl font-bold text-textPrimary dark:text-textPrimary-dark">
                  {total}
                </p>
                <p className="text-sm text-textSecondary dark:text-textSecondary-dark">
                  {t("pages.interventions.title")}
                </p>
              </div>
            )}
          </div>
        ) : (
          <MonthCalendar />
        )}

      </div>
    </div>
  );
};

export default InterventionsPage;
