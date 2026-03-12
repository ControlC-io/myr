import { useState, useEffect } from 'react';
import AdminCard from "./AdminCard";

interface AuditLog {
  id: string;
  action: string;
  userId: string | null;
  details: any;
  timestamp: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || '';

const LogsTab = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/admin/logs`, {
        headers: {
          'x-admin-secret': ADMIN_SECRET
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      
      const data = await response.json();
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Auto refresh every 10 seconds
    const interval = setInterval(fetchLogs, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDetails = (details: any): string => {
    if (!details) return '';
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  return (
    <AdminCard
      title="Audit Logs"
      subtitle="Recent system activity and changes (auto-refreshes every 10 seconds)."
      headerRight={
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-4 py-2 bg-secondary text-secondary-on-light dark:text-secondary-on-dark rounded-lg hover:bg-pink disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {loading ? "Refreshing..." : "Refresh now"}
        </button>
      }
    >
      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-textSecondary dark:text-textSecondary-dark">
            Loading logs...
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-header border-b border-border dark:border-border-dark">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-background dark:hover:bg-background-dark transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-textPrimary dark:text-textPrimary-dark">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex rounded px-2 py-1 text-xs font-medium bg-primary text-primary-on-light">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-textSecondary dark:text-textSecondary-dark">
                    {log.userId || (
                      <span className="italic text-textSecondary dark:text-textSecondary-dark">
                        System
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {log.details ? (
                      <details className="cursor-pointer">
                        <summary className="text-secondary hover:text-pink font-medium">
                          View details
                        </summary>
                        <pre className="mt-2 p-3 bg-background dark:bg-background-dark rounded border border-border dark:border-border-dark text-xs overflow-x-auto font-mono text-textPrimary dark:text-textPrimary-dark">
                          {formatDetails(log.details)}
                        </pre>
                      </details>
                    ) : (
                      <span className="italic text-textSecondary dark:text-textSecondary-dark">
                        No details
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-textSecondary dark:text-textSecondary-dark"
                  >
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
};

export default LogsTab;
