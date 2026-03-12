import { useState, useEffect, useCallback } from 'react';
import AdminCard from './AdminCard';
import {
  adminFetch,
  MEMBER_ROLES,
  type MemberRole,
  type Organization,
  type Member,
  type PaginatedResponse,
} from '../lib/adminApi';

const PAGE_LIMIT = 20;

const ROLE_BADGE: Record<MemberRole, string> = {
  OWNER:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  ADMIN:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  VIEWER:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const UserAvatar = ({ name, image }: { name: string | null; image: string | null }) => {
  const initials = (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  if (image) return <img src={image} alt={name ?? 'User'} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
  return (
    <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-semibold text-secondary">{initials}</span>
    </div>
  );
};

const MembersTab = () => {
  // ── Left panel ─────────────────────────────────────────────────────────────
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgPage, setOrgPage] = useState(1);
  const [orgTotalPages, setOrgTotalPages] = useState(1);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  // ── Right panel ────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberTotalPages, setMemberTotalPages] = useState(1);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // ── Add-member form ────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<MemberRole>('VIEWER');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // ── Change-role inline ─────────────────────────────────────────────────────
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [rolePickValue, setRolePickValue] = useState<MemberRole>('VIEWER');
  const [roleSaving, setRoleSaving] = useState(false);

  // ── Remove confirmation ────────────────────────────────────────────────────
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchOrgs = useCallback(async (p: number) => {
    try {
      setOrgsLoading(true);
      setOrgsError(null);
      const res = await adminFetch(`/api/admin/organizations?page=${p}&limit=${PAGE_LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch organizations`);
      const json: PaginatedResponse<Organization> = await res.json();
      setOrgs(json.data);
      setOrgPage(json.page);
      setOrgTotalPages(json.totalPages);
      if (p === 1 && !selectedOrg && json.data.length > 0) setSelectedOrg(json.data[0]);
    } catch (err) {
      setOrgsError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setOrgsLoading(false);
    }
  }, [selectedOrg]);

  const fetchMembers = useCallback(async (orgId: string, p: number) => {
    try {
      setMembersLoading(true);
      setMembersError(null);
      const res = await adminFetch(`/api/admin/organizations/${orgId}/members?page=${p}&limit=${PAGE_LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch members`);
      const json: PaginatedResponse<Member> = await res.json();
      setMembers(json.data);
      setMemberPage(json.page);
      setMemberTotal(json.total);
      setMemberTotalPages(json.totalPages);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgs(1); }, [fetchOrgs]);
  useEffect(() => {
    if (selectedOrg) { setMemberPage(1); fetchMembers(selectedOrg.id, 1); }
  }, [selectedOrg, fetchMembers]);

  const handleSelectOrg = (org: Organization) => { setSelectedOrg(org); setMembers([]); setShowAdd(false); };

  // ── Add member ─────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await adminFetch(`/api/admin/organizations/${selectedOrg.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: addEmail.trim().toLowerCase(), role: addRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setShowAdd(false);
      setAddEmail('');
      setAddRole('VIEWER');
      fetchMembers(selectedOrg.id, 1);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAdding(false);
    }
  };

  // ── Change role ────────────────────────────────────────────────────────────
  const handleRoleSave = async (member: Member) => {
    if (!selectedOrg) return;
    setRoleSaving(true);
    try {
      const res = await adminFetch(`/api/admin/organizations/${selectedOrg.id}/members/${member.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: rolePickValue }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditingMemberId(null);
      fetchMembers(selectedOrg.id, memberPage);
    } catch {
      // keep editing open on error
    } finally {
      setRoleSaving(false);
    }
  };

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!selectedOrg || !removingMember) return;
    setRemoveLoading(true);
    try {
      const res = await adminFetch(
        `/api/admin/organizations/${selectedOrg.id}/members/${removingMember.userId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRemovingMember(null);
      fetchMembers(selectedOrg.id, memberPage);
    } catch {
      // silent fail; user can retry
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <div className="w-full lg:w-1/3 flex-shrink-0">
          <AdminCard title="Organizations" subtitle="Select one to manage members.">
            {orgsError && (
              <div className="mx-4 mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">{orgsError}</div>
            )}
            {orgsLoading && orgs.length === 0 ? (
              <div className="p-6 animate-pulse space-y-3">{[1,2,3].map((i) => <div key={i} className="h-10 bg-gray-200 rounded"/>)}</div>
            ) : orgs.length === 0 ? (
              <div className="p-6 text-sm text-center text-textSecondary dark:text-textSecondary-dark">No organizations found.</div>
            ) : (
              <ul className="divide-y divide-border dark:divide-border-dark">
                {orgs.map((org) => (
                  <li key={org.id}>
                    <button
                      onClick={() => handleSelectOrg(org)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        selectedOrg?.id === org.id
                          ? 'bg-secondary/10 border-l-2 border-secondary'
                          : 'hover:bg-background dark:hover:bg-background-dark border-l-2 border-transparent'
                      }`}
                    >
                      <p className="font-medium text-sm text-textPrimary dark:text-textPrimary-dark truncate">{org.name}</p>
                      <p className="text-xs text-textSecondary dark:text-textSecondary-dark mt-0.5">
                        {org.slug} · {org._count.members} member{org._count.members !== 1 ? 's' : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {orgTotalPages > 1 && (
              <div className="flex justify-between items-center px-4 py-3 border-t border-border dark:border-border-dark">
                <button onClick={() => fetchOrgs(orgPage - 1)} disabled={orgPage <= 1 || orgsLoading}
                  className="text-xs px-2 py-1 border border-border dark:border-border-dark rounded disabled:opacity-40 hover:bg-background dark:hover:bg-background-dark">← Prev</button>
                <span className="text-xs text-textSecondary dark:text-textSecondary-dark">{orgPage}/{orgTotalPages}</span>
                <button onClick={() => fetchOrgs(orgPage + 1)} disabled={orgPage >= orgTotalPages || orgsLoading}
                  className="text-xs px-2 py-1 border border-border dark:border-border-dark rounded disabled:opacity-40 hover:bg-background dark:hover:bg-background-dark">Next →</button>
              </div>
            )}
          </AdminCard>
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────── */}
        <div className="w-full lg:w-2/3">
          <AdminCard
            title={selectedOrg ? `Members · ${selectedOrg.name}` : 'Members'}
            subtitle={selectedOrg
              ? `${memberTotal} member${memberTotal !== 1 ? 's' : ''}`
              : 'Select an organization on the left.'}
            headerRight={
              selectedOrg ? (
                <button
                  onClick={() => { setShowAdd((v) => !v); setAddError(null); }}
                  className="px-3 py-1.5 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  {showAdd ? 'Cancel' : '+ Add Member'}
                </button>
              ) : undefined
            }
          >
            {/* Add-member inline form */}
            {showAdd && selectedOrg && (
              <div className="px-4 py-3 border-b border-border dark:border-border-dark bg-background dark:bg-background-dark">
                <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-textSecondary dark:text-textSecondary-dark mb-1">Email</label>
                    <input
                      type="email" required
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full rounded border border-border dark:border-border-dark bg-surface dark:bg-surface-dark px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-textSecondary dark:text-textSecondary-dark mb-1">Role</label>
                    <select
                      value={addRole}
                      onChange={(e) => setAddRole(e.target.value as MemberRole)}
                      className="rounded border border-border dark:border-border-dark bg-surface dark:bg-surface-dark px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                    >
                      {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button type="submit" disabled={adding}
                    className="px-4 py-1.5 text-sm font-medium bg-secondary text-white rounded disabled:opacity-50">
                    {adding ? 'Adding…' : 'Add'}
                  </button>
                </form>
                {addError && <p className="text-xs text-red-600 mt-2">{addError}</p>}
              </div>
            )}

            {!selectedOrg ? (
              <div className="p-12 text-center">
                <svg className="mx-auto mb-4 h-12 w-12 text-textSecondary dark:text-textSecondary-dark opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-textSecondary dark:text-textSecondary-dark">No organization selected.</p>
              </div>
            ) : membersError ? (
              <div className="m-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{membersError}</div>
            ) : membersLoading && members.length === 0 ? (
              <div className="p-8 animate-pulse space-y-3">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                    <div className="flex-1 h-4 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="p-12 text-center text-sm text-textSecondary dark:text-textSecondary-dark">
                No members in this organization.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border dark:divide-border-dark text-sm">
                    <thead className="table-header">
                      <tr>
                        {['User', 'Email', 'Role', ''].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-border-dark">
                      {members.map((m) => (
                        <tr key={m.id} className="hover:bg-background dark:hover:bg-background-dark transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar name={m.user.name} image={m.user.image} />
                              <span className="font-medium text-textPrimary dark:text-textPrimary-dark truncate max-w-[140px]">
                                {m.user.name ?? <span className="italic opacity-50">—</span>}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-textSecondary dark:text-textSecondary-dark">{m.user.email}</td>
                          <td className="px-4 py-3">
                            {editingMemberId === m.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={rolePickValue}
                                  onChange={(e) => setRolePickValue(e.target.value as MemberRole)}
                                  className="text-xs rounded border border-border dark:border-border-dark bg-surface dark:bg-surface-dark px-2 py-1 focus:outline-none"
                                >
                                  {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button onClick={() => handleRoleSave(m)} disabled={roleSaving}
                                  className="text-xs text-green-600 hover:underline disabled:opacity-50">
                                  {roleSaving ? '…' : 'Save'}
                                </button>
                                <button onClick={() => setEditingMemberId(null)}
                                  className="text-xs text-textSecondary dark:text-textSecondary-dark hover:underline">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingMemberId(m.id); setRolePickValue(m.role); }}
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer hover:opacity-80 ${ROLE_BADGE[m.role]}`}
                                title="Click to change role"
                              >
                                {m.role}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setRemovingMember(m)}
                              className="text-xs text-red-500 hover:text-red-700 hover:underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {memberTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border dark:border-border-dark">
                    <p className="text-xs text-textSecondary dark:text-textSecondary-dark">Page {memberPage} of {memberTotalPages}</p>
                    <div className="flex gap-2">
                      <button onClick={() => fetchMembers(selectedOrg.id, memberPage - 1)} disabled={memberPage <= 1 || membersLoading}
                        className="text-xs px-2 py-1 border border-border dark:border-border-dark rounded disabled:opacity-40 hover:bg-background dark:hover:bg-background-dark">← Prev</button>
                      <button onClick={() => fetchMembers(selectedOrg.id, memberPage + 1)} disabled={memberPage >= memberTotalPages || membersLoading}
                        className="text-xs px-2 py-1 border border-border dark:border-border-dark rounded disabled:opacity-40 hover:bg-background dark:hover:bg-background-dark">Next →</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </AdminCard>
        </div>
      </div>

      {/* ── Remove confirmation modal ────────────────────────────────────────── */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-textPrimary dark:text-textPrimary-dark">Remove Member</h2>
            <p className="text-sm text-textSecondary dark:text-textSecondary-dark">
              Remove <span className="font-medium text-textPrimary dark:text-textPrimary-dark">{removingMember.user.email}</span> from{' '}
              <span className="font-medium text-textPrimary dark:text-textPrimary-dark">{selectedOrg?.name}</span>?
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRemovingMember(null)}
                className="px-4 py-2 text-sm border border-border dark:border-border-dark rounded-lg hover:bg-background dark:hover:bg-background-dark">
                Cancel
              </button>
              <button onClick={handleRemove} disabled={removeLoading}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {removeLoading ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersTab;
