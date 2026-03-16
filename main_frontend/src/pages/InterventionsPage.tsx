import { useState } from "react";
import { useTranslation } from "react-i18next";
import MonthCalendar from "../components/MonthCalendar";

type Tab = "list" | "calendar";

const InterventionsPage = () => {
  const { t } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<Tab>("list");

  return (
    <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark">
          {t("pages.interventions.title")}
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
            <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
              {t("pages.interventions.empty")}
            </div>
          </div>
        ) : (
          <MonthCalendar />
        )}

      </div>
    </div>
  );
};

export default InterventionsPage;
