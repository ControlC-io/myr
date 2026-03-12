import { useState, useEffect, useCallback } from 'react';
import AdminCard from './AdminCard';
import { adminFetch, type Organization, type PaginatedResponse } from '../lib/adminApi';

const PAGE_LIMIT = 20;

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
};

interface CreateForm { name: string; slug: string; externalReferenceId: string }
interface EditForm  { name: string; externalReferenceId: string }

const emptyCreate = (): CreateForm => ({ name: '', slug: '', externalReferenceId: '' });
const emptyEdit   = (org: Organization): EditForm => ({
  name: org.name,
  externalReferenceId: org.externalReferenceId ?? '',
});

const OrganizationsTab = () => {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Create dialog state ────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Edit dialog state ──────────────────────────────────────────────────────
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', externalReferenceId: '' });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchOrgs = useCallback(async (p: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminFetch(`/api/admin/organizations?page=${p}&limit=${PAGE_LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch organizations`);
      const json: PaginatedResponse<Organization> = await res.json();
      setOrgs(json.data);
      setTotal(json.total);
      setPage(json.page);
      setTotalPages(json.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgs(1); }, [fetchOrgs]);

  // ── Create handler ─────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await adminFetch('/api/admin/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          slug: createForm.slug,
          externalReferenceId: createForm.externalReferenceId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setShowCreate(false);
      setCreateForm(emptyCreate());
      fetchOrgs(1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  // ── Edit handler ───────────────────────────────────────────────────────────
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrg) return;
    setEditing(true);
    setEditError(null);
    try {
      const res = await adminFetch(`/api/admin/organizations/${editOrg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          externalReferenceId: editForm.externalReferenceId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setEditOrg(null);
      fetchOrgs(page);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setEditing(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminCard
        title="Organizations"
        subtitle="All tenant organizations registered in the system."
        headerRight={
          <div className="flex gap-2">
            <button
              onClick={() => { setShowCreate(true); setCreateError(null); setCreateForm(emptyCreate()); }}
              className="px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              + New Org
            </button>
            <button
              onClick={() => fetchOrgs(page)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary border border-border dark:border-border-dark rounded-lg hover:bg-background dark:hover:bg-background-dark transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        }
      >
        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}

        {loading && orgs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="animate-pulse flex flex-col items-center gap-3">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-2/5" />
            </div>
            <p className="text-sm text-textSecondary dark:text-textSecondary-dark mt-4">Loading organizations…</p>
          </div>
        ) : orgs.length === 0 && !error ? (
          <div className="p-12 text-center text-sm text-textSecondary dark:text-textSecondary-dark">
            No organizations found. Create one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border dark:divide-border-dark text-sm">
              <thead className="table-header">
                <tr>
                  {['Name', 'Slug', 'Members', 'External Ref', 'Created', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-border-dark">
                {orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-background dark:hover:bg-background-dark transition-colors">
                    <td className="px-4 py-3 font-medium text-textPrimary dark:text-textPrimary-dark">{org.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-textSecondary dark:text-textSecondary-dark">{org.slug}</td>
                    <td className="px-4 py-3 tabular-nums text-textPrimary dark:text-textPrimary-dark">{org._count.members}</td>
                    <td className="px-4 py-3 font-mono text-xs text-textSecondary dark:text-textSecondary-dark">
                      {org.externalReferenceId ?? <span className="italic opacity-50">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-textSecondary dark:text-textSecondary-dark">{formatDate(org.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setEditOrg(org); setEditForm(emptyEdit(org)); setEditError(null); }}
                        className="text-xs text-secondary hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border dark:border-border-dark">
            <p className="text-sm text-textSecondary dark:text-textSecondary-dark">
              {total} organization{total !== 1 ? 's' : ''} · page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button onClick={() => fetchOrgs(page - 1)} disabled={page <= 1 || loading}
                className="px-3 py-1.5 text-sm border border-border dark:border-border-dark rounded-lg disabled:opacity-40 hover:bg-background dark:hover:bg-background-dark">
                ← Prev
              </button>
              <button onClick={() => fetchOrgs(page + 1)} disabled={page >= totalPages || loading}
                className="px-3 py-1.5 text-sm border border-border dark:border-border-dark rounded-lg disabled:opacity-40 hover:bg-background dark:hover:bg-background-dark">
                Next →
              </button>
            </div>
          </div>
        )}
      </AdminCard>

      {/* ── Create dialog ──────────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-textPrimary dark:text-textPrimary-dark">Create Organization</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textSecondary dark:text-textSecondary-dark mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Acme Corp"
                  className="w-full rounded-lg border border-border dark:border-border-dark bg-background dark:bg-background-dark px-3 py-2 text-sm text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary dark:text-textSecondary-dark mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={createForm.slug}
                  onChange={(e) => setCreateForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  placeholder="acme-corp"
                  className="w-full rounded-lg border border-border dark:border-border-dark bg-background dark:bg-background-dark px-3 py-2 text-sm font-mono text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-secondary"
                />
                <p className="text-xs text-textSecondary dark:text-textSecondary-dark mt-1">Lowercase letters, numbers and hyphens only.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary dark:text-textSecondary-dark mb-1">External Reference ID</label>
                <input
                  type="text"
                  value={createForm.externalReferenceId}
                  onChange={(e) => setCreateForm(f => ({ ...f, externalReferenceId: e.target.value }))}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-border dark:border-border-dark bg-background dark:bg-background-dark px-3 py-2 text-sm text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm border border-border dark:border-border-dark rounded-lg hover:bg-background dark:hover:bg-background-dark">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit dialog ────────────────────────────────────────────────────────── */}
      {editOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-textPrimary dark:text-textPrimary-dark">Edit Organization</h2>
            <p className="text-xs font-mono text-textSecondary dark:text-textSecondary-dark">{editOrg.slug}</p>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textSecondary dark:text-textSecondary-dark mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-border dark:border-border-dark bg-background dark:bg-background-dark px-3 py-2 text-sm text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary dark:text-textSecondary-dark mb-1">External Reference ID</label>
                <input
                  type="text"
                  value={editForm.externalReferenceId}
                  onChange={(e) => setEditForm(f => ({ ...f, externalReferenceId: e.target.value }))}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-border dark:border-border-dark bg-background dark:bg-background-dark px-3 py-2 text-sm text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditOrg(null)}
                  className="px-4 py-2 text-sm border border-border dark:border-border-dark rounded-lg hover:bg-background dark:hover:bg-background-dark">
                  Cancel
                </button>
                <button type="submit" disabled={editing}
                  className="px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                  {editing ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationsTab;
