import { useTranslation } from "react-i18next";

interface StatusOption {
  label: string;
  value: string;
}

interface TableFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: StatusOption[];
  dateFrom?: string;
  onDateFromChange?: (value: string) => void;
  dateTo?: string;
  onDateToChange?: (value: string) => void;
  showDateFilters?: boolean;
}

const TableFilters = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  showDateFilters = true,
}: TableFiltersProps) => {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-wrap items-center gap-4 py-4 border-b border-border/50 dark:border-border-dark/50 mb-4">
      {/* Search */}
      <div className="relative min-w-[240px] flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-textSecondary dark:text-textSecondary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-border dark:border-border-dark rounded-md leading-5 bg-surface dark:bg-surface-dark text-textPrimary dark:text-textPrimary-dark placeholder-textSecondary dark:placeholder-textSecondary-dark focus:outline-none focus:ring-1 focus:ring-primary dark:focus:ring-primary-dark sm:text-xs transition-colors"
          placeholder={t("filters.search", "Search...")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Status */}
      {onStatusChange && statusOptions && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
            {t("filters.status", "Status")}:
          </label>
          <select
            className="block w-full pl-3 pr-10 py-2 text-xs border border-border dark:border-border-dark focus:outline-none focus:ring-primary dark:focus:ring-primary-dark sm:text-xs rounded-md bg-surface dark:bg-surface-dark text-textPrimary dark:text-textPrimary-dark transition-colors"
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

      {/* Date Range */}
      {showDateFilters && onDateFromChange && onDateToChange && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
              {t("filters.dateFrom", "From")}:
            </label>
            <input
              type="date"
              className="block w-full px-2 py-2 text-xs border border-border dark:border-border-dark focus:outline-none focus:ring-primary dark:focus:ring-primary-dark sm:text-xs rounded-md bg-surface dark:bg-surface-dark text-textPrimary dark:text-textPrimary-dark transition-colors"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
              {t("filters.dateTo", "To")}:
            </label>
            <input
              type="date"
              className="block w-full px-2 py-2 text-xs border border-border dark:border-border-dark focus:outline-none focus:ring-primary dark:focus:ring-primary-dark sm:text-xs rounded-md bg-surface dark:bg-surface-dark text-textPrimary dark:text-textPrimary-dark transition-colors"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TableFilters;
