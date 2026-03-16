import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export interface StatusOption {
  label: string;
  value: string;
}

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  count?: number;
  search: string;
  onSearchChange: (value: string) => void;
  status?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: StatusOption[];
  dateFrom?: string;
  onDateFromChange?: (value: string) => void;
  dateTo?: string;
  onDateToChange?: (value: string) => void;
  isRefetching?: boolean;
  onRefetch?: () => void;
  extraRight?: React.ReactNode;
  disabled?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  count,
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  isRefetching,
  onRefetch,
  extraRight,
  disabled = false,
}) => {
  const { t } = useTranslation("common");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasActiveFilters = Boolean(search || status || dateFrom || dateTo);

  const clearFilters = () => {
    onSearchChange("");
    onStatusChange?.("");
    onDateFromChange?.("");
    onDateToChange?.("");
  };

  return (
    <header className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Left: icon + title + badge */}
        <div className="flex items-center gap-2 shrink-0">
          {icon && <span className="p-1 rounded bg-pink/20 text-pink">{icon}</span>}
          <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark">
            {title}
          </h1>
          {count !== undefined && count > 0 && (
            <span className="h-5 w-5 rounded-full bg-pink text-white text-[10px] font-bold flex items-center justify-center">
              {count}
            </span>
          )}
        </div>

        {/* Right: search + filter toggle + refresh + extra */}
        {!disabled && (
          <div className="flex flex-1 items-center gap-2 justify-end">
            {extraRight && <div className="mr-2">{extraRight}</div>}

            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-3.5 w-3.5 text-textSecondary dark:text-textSecondary-dark"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                className="pl-9 pr-3 py-1.5 text-xs border border-border dark:border-border-dark rounded-md bg-surface dark:bg-surface-dark text-textPrimary dark:text-textPrimary-dark placeholder-textSecondary dark:placeholder-textSecondary-dark focus:outline-none focus:ring-1 focus:ring-secondary w-48 transition-colors"
                placeholder={t("filters.search", "Search...")}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>

            {/* Clear filters button — visible only when filters are active */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                title={t("filters.clear", "Clear filters")}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-border dark:border-border-dark text-textSecondary dark:text-textSecondary-dark hover:text-pink hover:border-pink/40 hover:bg-pink/5 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t("filters.clear", "Clear filters")}
              </button>
            )}

            {/* Filter toggle button */}
            {(onStatusChange || onDateFromChange || onDateToChange) && (
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                title={t("filters.toggle", "Filters")}
                className={`relative inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors focus:outline-none focus:ring-1 focus:ring-secondary ${
                  filtersOpen
                    ? "bg-secondary/15 border-secondary/40 text-secondary dark:text-secondary"
                    : "bg-surface dark:bg-surface-dark border-border dark:border-border-dark text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark hover:bg-background dark:hover:bg-background-dark"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4h18M7 8h10M11 12h2M11 16h2"
                  />
                </svg>
                {/* dot indicator when filters are active */}
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-secondary" />
                )}
              </button>
            )}

            {/* Refresh */}
            {onRefetch && (
              <button
                type="button"
                disabled={isRefetching}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-pink text-white hover:bg-pink/90 transition-colors shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={onRefetch}
              >
                <svg
                  className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {isRefetching
                  ? t("actions.refreshing", "Refreshing...")
                  : t("actions.refresh", "Refresh")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Collapsible filters panel */}
      {filtersOpen && !disabled && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Status */}
          {onStatusChange && statusOptions && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                {t("filters.status", "Status")}:
              </label>
              <select
                className="pl-2 pr-7 py-1.5 text-xs border border-border dark:border-border-dark rounded-md bg-background dark:bg-background-dark text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-1 focus:ring-secondary transition-colors"
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
              >
                <option value="">{t("filters.all", "All")}</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range: From */}
          {onDateFromChange && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                {t("filters.dateFrom", "From")}:
              </label>
              <input
                type="date"
                className="px-2 py-1.5 text-xs border border-border dark:border-border-dark rounded-md bg-background dark:bg-background-dark text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-1 focus:ring-secondary transition-colors"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
            </div>
          )}

          {/* Date Range: To */}
          {onDateToChange && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                {t("filters.dateTo", "To")}:
              </label>
              <input
                type="date"
                className="px-2 py-1.5 text-xs border border-border dark:border-border-dark rounded-md bg-background dark:bg-background-dark text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-1 focus:ring-secondary transition-colors"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
              />
            </div>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-xs text-textSecondary dark:text-textSecondary-dark hover:text-pink dark:hover:text-pink transition-colors"
            >
              {t("filters.clear", "Clear filters")}
            </button>
          )}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
