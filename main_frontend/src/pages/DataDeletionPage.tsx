import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";

const DataDeletionPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
        <p className="text-sec text-sm">{t("placeholders.loading")}</p>
      </div>
    );
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // TODO: hook into backend endpoint when available
  };

  return (
    <div className="bg-background dark:bg-background-dark min-h-[calc(100vh-3.5rem)] py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <form
          onSubmit={handleSubmit}
          className="card rounded-2xl px-8 py-8 space-y-6"
        >
          <h1 className="text-2xl font-bold text-textPrimary dark:text-white text-center">
            {t("pages.dataDeletion.title")}
          </h1>

          <p className="text-sm text-textSecondary dark:text-textSecondary-dark leading-relaxed text-center">
            {t("pages.dataDeletion.description")}
          </p>

          <div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              placeholder={t("pages.dataDeletion.placeholder")}
              className="w-full border border-border dark:border-border-dark rounded-lg px-4 py-3 text-sm bg-surface dark:bg-surface-dark text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary/60 resize-none"
            />
          </div>

          <label className="flex items-start gap-3 text-xs text-textSecondary dark:text-textSecondary-dark">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 w-4 h-4 accent-secondary"
            />
            <span>{t("pages.dataDeletion.confirmation")}</span>
          </label>

          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={!confirmed || !message.trim()}
              className="inline-flex items-center justify-center px-8 py-3 rounded-full text-sm font-bold tracking-widest uppercase bg-secondary text-white hover:bg-secondary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t("pages.dataDeletion.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DataDeletionPage;

