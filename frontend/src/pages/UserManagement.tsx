import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, UserPlus, Edit2, Trash2, Shield, Search,
  X, Check, AlertTriangle, Eye, EyeOff, RefreshCw,
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  createdAt: string;
  updatedAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/10 text-[var(--danger)]',
  MANAGER: 'bg-amber-500/10 text-[var(--warning)]',
  STAFF: 'bg-[rgba(37,99,235,0.08)] text-[var(--accent)]',
};

const ROLE_ICONS: Record<string, string> = {
  ADMIN: '👑',
  MANAGER: '🎯',
  STAFF: '👤',
};

const AVATAR_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/10 text-[var(--danger)] border-red-500/20',
  MANAGER: 'bg-amber-500/10 text-[var(--warning)] border-amber-500/20',
  STAFF: 'bg-[rgba(37,99,235,0.08)] text-[var(--accent)] border-[var(--accent-light)]/20',
};

interface UserModalProps {
  user?: User | null;
  onClose: () => void;
  onSave: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'STAFF',
    password: '',
    confirmPassword: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user && !form.password) { setError('Password is required for new users'); return; }
    if (form.password && form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const data: any = { name: form.name, email: form.email, role: form.role };
      if (form.password) data.password = form.password;

      if (user) {
        await api.users.update(user.id, data);
      } else {
        await api.users.create(data);
      }
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="modal bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-[rgba(37,99,235,0.08)] flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{user ? 'Edit User' : 'Add User'}</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 bg-[rgba(239,68,68,0.08)] border border-red-500/20 rounded-lg p-3 text-[13px] text-[var(--danger)]">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-wide">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="John Doe"
              className="w-full h-10 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[#52525b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-wide">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="john@company.com"
              className="w-full h-10 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[#52525b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-wide">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as any })}
              className="w-full h-10 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent)] transition-colors"
            >
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-wide">
              Password {user && <span className="text-[var(--text-muted)] normal-case font-normal">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={user ? 'New password (optional)' : 'Min 8 characters'}
                className="w-full h-10 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 pr-9 text-[13px] text-[var(--text-primary)] placeholder-[#52525b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent)] transition-colors"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          {form.password && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-wide">Confirm Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Repeat password"
                  className="w-full h-10 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 pr-9 text-[13px] text-[var(--text-primary)] placeholder-[#52525b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent)] transition-colors"
                />
                {form.confirmPassword && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${form.password === form.confirmPassword ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {form.password === form.confirmPassword ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] text-[13px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 px-3 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[#3b82f6] text-[13px] font-medium text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading
                ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : user ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.users.list();
      if (res.success) setUsers(res.users);
    } catch (err: any) {
      showToast(err.message || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (id: string) => {
    try {
      await api.users.delete(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast('User deleted successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user', 'error');
    }
    setDeleteConfirm(null);
  };

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = {
    ADMIN: users.filter((u) => u.role === 'ADMIN').length,
    MANAGER: users.filter((u) => u.role === 'MANAGER').length,
    STAFF: users.filter((u) => u.role === 'STAFF').length,
  };

  // Avatar initials helper
  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-0">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg ${
          toast.type === 'success'
            ? 'bg-[var(--bg-elevated)] border border-[#10b981]/30 text-[var(--success)]'
            : 'bg-[var(--bg-elevated)] border border-red-500/30 text-[var(--danger)]'
        }`}>
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Page Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">User Management</h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Manage team members, roles, and access control</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchUsers}
            className="btn-ghost p-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setEditUser(null); setShowModal(true); }}
            className="btn-primary flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[#3b82f6] text-white text-[13px] font-medium shadow-sm transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">

        {/* ── KPI Row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { role: 'ADMIN', label: 'Administrators', count: roleCounts.ADMIN, desc: 'Full system access', colorClass: 'text-[var(--danger)]', bgClass: 'bg-red-500/10' },
            { role: 'MANAGER', label: 'Managers', count: roleCounts.MANAGER, desc: 'Operations access', colorClass: 'text-[var(--warning)]', bgClass: 'bg-amber-500/10' },
            { role: 'STAFF', label: 'Staff Members', count: roleCounts.STAFF, desc: 'View & basic access', colorClass: 'text-[var(--accent)]', bgClass: 'bg-[rgba(37,99,235,0.08)]' },
          ].map((card) => (
            <button
              key={card.role}
              onClick={() => setRoleFilter(roleFilter === card.role ? 'ALL' : card.role)}
              className={`panel px-5 py-4 text-left rounded-xl border transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${
                roleFilter === card.role
                  ? 'bg-[var(--bg-elevated)] border-[var(--border-strong)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <div className="flex items-center space-x-2 mb-2">
                <div className={`h-7 w-7 rounded-lg ${card.bgClass} flex items-center justify-center`}>
                  <Shield className={`h-4 w-4 ${card.colorClass}`} />
                </div>
                <span className={`text-xs font-medium tracking-wide uppercase ${card.colorClass}`}>{card.label}</span>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums font-['JetBrains_Mono']">{card.count}</div>
              <div className="text-[13px] text-[var(--text-muted)] mt-0.5">{card.desc}</div>
            </button>
          ))}
        </div>

        {/* ── Search bar ───────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-2 text-[13px] text-[var(--text-primary)] placeholder-[#52525b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[var(--accent)] transition-colors"
          />
        </div>

        {/* ── Users Data Table ─────────────────────────────────────────── */}
        <div className="panel bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase whitespace-nowrap ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-[var(--border)]/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="skeleton h-3 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ width: `${55 + Math.random() * 30}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-[#27272a]/50 mb-3">
                        <Users className="h-6 w-6 text-[var(--text-muted)]" />
                      </div>
                      <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No users found</p>
                      <p className="text-[13px] text-[var(--text-muted)]">Try adjusting your search or filters.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)] transition-colors ${u.id === currentUser?.id ? 'bg-[rgba(37,99,235,0.04)]' : ''}`}
                    >
                      {/* Name */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center space-x-2.5">
                          <div className={`h-7 w-7 rounded-lg border flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${AVATAR_COLORS[u.role]}`}>
                            {getInitials(u.name)}
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[13px] font-medium text-[var(--text-primary)]">{u.name}</span>
                            {u.id === currentUser?.id && (
                              <span className="badge badge-blue text-[9px] bg-[rgba(37,99,235,0.08)] text-[var(--accent)] px-1.5 py-0.5 rounded-full font-semibold">YOU</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-2.5">
                        <span className="text-[13px] text-[var(--text-muted)]">{u.email}</span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-2.5">
                        <span className={`badge inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_COLORS[u.role]}`}>
                          {u.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5">
                        <span className="badge badge-success inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(16,185,129,0.08)] text-[var(--success)]">
                          Active
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-2.5">
                        <span className="text-[13px] text-[var(--text-muted)]">
                          {new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => { setEditUser(u); setShowModal(true); }}
                            className="btn-ghost p-1.5 rounded-lg hover:bg-[#27272a] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                            title="Edit user"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {u.id !== currentUser?.id && (
                            deleteConfirm === u.id ? (
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => handleDelete(u.id)}
                                  className="p-1.5 rounded-lg bg-[rgba(239,68,68,0.08)] hover:bg-red-500/20 text-[var(--danger)] transition-colors"
                                  title="Confirm delete"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="btn-ghost p-1.5 rounded-lg hover:bg-[#27272a] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(u.id)}
                                className="btn-ghost p-1.5 rounded-lg hover:bg-[#27272a] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[var(--border)] text-[13px] text-[var(--text-muted)]">
              Showing {filtered.length} of {users.length} users
            </div>
          )}
        </div>
      </div>

      {/* ── Add/Edit Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <UserModal
          user={editUser}
          onClose={() => { setShowModal(false); setEditUser(null); }}
          onSave={fetchUsers}
        />
      )}
    </div>
  );
};
