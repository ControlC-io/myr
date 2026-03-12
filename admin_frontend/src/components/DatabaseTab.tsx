import { useState, useEffect, useCallback } from 'react';
import AdminCard from "./AdminCard";

type TableName =
  | 'users'
  | 'accounts'
  | 'sessions'
  | 'system_settings'
  | 'two_factor'
  | 'audit_logs';

interface TableInfo {
  name: TableName;
  label: string;
  description: string;
}

interface TableCounts {
  tables: Record<string, { count: number }>;
}

const TABLES: TableInfo[] = [
  { name: 'users', label: 'Users', description: 'Registered user accounts' },
  { name: 'accounts', label: 'Accounts', description: 'OAuth provider accounts' },
  { name: 'sessions', label: 'Sessions', description: 'Active user sessions' },
  { name: 'system_settings', label: 'System Settings', description: 'Feature flags and config' },
  { name: 'two_factor', label: 'Two Factor', description: '2FA configurations' },
  { name: 'audit_logs', label: 'Audit Logs', description: 'Security audit trail' }
];

const API_BASE = import.meta.env.VITE_API_URL || '';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || '';

const adminHeaders = {
  'x-admin-secret': ADMIN_SECRET,
  'Content-Type': 'application/json'
};

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const isDateField = (key: string): boolean =>
  ['createdAt', 'updatedAt', 'expiresAt', 'timestamp'].includes(key);

const formatDate = (value: string): string => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const DatabaseTab = () => {
  const [selectedTable, setSelectedTable] = useState<TableName | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [tableCounts, setTableCounts] = useState<TableCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/api/admin/database`, {
        headers: adminHeaders
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch counts`);
      const data: TableCounts = await response.json();
      setTableCounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error fetching table counts');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTableData = useCallback(async (table: TableName) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/api/admin/database?table=${table}`, {
        headers: adminHeaders
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch table data`);
      const result: { table: string; data: Record<string, unknown>[] } = await response.json();
      setTableData(result.data);
      setSelectedTable(table);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error fetching data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const getCount = (tableName: string): number =>
    tableCounts?.tables[tableName]?.count ?? 0;

  const columnKeys = tableData.length > 0 ? Object.keys(tableData[0]) : [];

  const handleRefresh = () => {
    fetchCounts();
    if (selectedTable) fetchTableData(selectedTable);
  };

  return (
    <div className="space-y-6">
      <AdminCard
        title="Database Viewer"
        subtitle="Explore all database tables. Sensitive fields are redacted."
        headerRight={
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary text-secondary-on-light dark:text-secondary-on-dark bg-primary border border-border dark:border-border-dark rounded-lg hover:bg-pink transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
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
            Refresh
          </button>
        }
      >
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
      </AdminCard>

      {/* Table selector grid */}
      <AdminCard title="Select a table">
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TABLES.map((t) => (
            <button
              key={t.name}
              onClick={() => fetchTableData(t.name)}
              disabled={loading}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedTable === t.name
                  ? "border-secondary bg-primary"
                  : "border-border dark:border-border-dark hover:border-secondary hover:bg-background dark:hover:bg-background-dark"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-textPrimary dark:text-textPrimary-dark">
                    {t.label}
                  </p>
                  <p className="text-xs text-textSecondary dark:text-textSecondary-dark mt-0.5">
                    {t.description}
                  </p>
                </div>
                <span
                  className={`text-lg font-bold tabular-nums ${
                    selectedTable === t.name ? "text-secondary" : "text-textSecondary dark:text-textSecondary-dark"
                  }`}
                >
                  {getCount(t.name)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </AdminCard>

      {/* Data table */}
      {selectedTable && !loading && (
        <AdminCard
          title={TABLES.find((t) => t.name === selectedTable)?.label}
          subtitle={`${tableData.length} record${tableData.length !== 1 ? "s" : ""}`}
        >
          {tableData.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto mb-4 h-12 w-12 text-textSecondary dark:text-textSecondary-dark"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-sm text-textSecondary dark:text-textSecondary-dark">
                No records found in this table.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border dark:divide-border-dark text-sm">
                <thead className="table-header">
                  <tr>
                    {columnKeys.map((key) => (
                      <th
                        key={key}
                        className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-border-dark">
                  {tableData.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-background dark:hover:bg-background-dark transition-colors"
                    >
                      {columnKeys.map((key) => {
                        const raw = row[key];
                        const display =
                          isDateField(key) && typeof raw === "string"
                            ? formatDate(raw)
                            : formatCellValue(raw);
                        return (
                          <td
                            key={key}
                            className="px-4 py-3 font-mono text-xs text-textPrimary dark:text-textPrimary-dark"
                          >
                            <div
                              className="max-w-xs truncate"
                              title={formatCellValue(raw)}
                            >
                              {display === "null" ? (
                                <span className="italic text-textSecondary dark:text-textSecondary-dark">
                                  null
                                </span>
                              ) : display === "[REDACTED]" ? (
                                <span className="rounded bg-yellow-50 px-1 py-0.5 text-xs text-yellow-700">
                                  [REDACTED]
                                </span>
                              ) : (
                                display
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      )}

      {/* Loading skeleton for data table */}
      {loading && selectedTable && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/5"></div>
          </div>
          <p className="text-sm text-gray-400 mt-4">Loading data...</p>
        </div>
      )}
    </div>
  );
};

export default DatabaseTab;
