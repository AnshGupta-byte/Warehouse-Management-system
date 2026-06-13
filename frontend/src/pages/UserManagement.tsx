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
  ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
  MANAGER: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  STAFF: 'bg-[#1e2d45]/60 text-[#3b82f6] border-[#243552]',
};

const ROLE_ICONS: Record<string, string> = {
  ADMIN: '👑',
  MANAGER: '🎯',
  STAFF: '👤',
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0b1120] border border-[#1e2d45] rounded-md w-full max-w-sm shadow-md">
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d45]">
          <div className="flex items-center space-x-2">
            <UserPlus className="h-3.5 w-3.5 text-[#3b82f6]" />
            <span className="text-xs font-semibold text-white">{user ? 'Edit User' : 'Add User'}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-[#0f1729] text-[#4a5f7a] hover:text-[#94a3b8] transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div className="flex items-center space-x-2 bg-red-500/5 border border-red-500/20 rounded-md p-2.5 text-[11px] text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold text-[#4a5f7a] mb-1.5 uppercase tracking-widest">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="John Doe"
              className="w-full bg-[#0f1729] border border-[#1e2d45] rounded-md px-3 py-2 text-[12px] text-white placeholder-[#4a5f7a] focus:outline-none focus:border-[#243552] transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-semibold text-[#4a5f7a] mb-1.5 uppercase tracking-widest">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="john@company.com"
              className="w-full bg-[#0f1729] border border-[#1e2d45] rounded-md px-3 py-2 text-[12px] text-white placeholder-[#4a5f7a] focus:outline-none focus:border-[#243552] transition-colors"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-[10px] font-semibold text-[#4a5f7a] mb-1.5 uppercase tracking-widest">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as any })}
              className="w-full bg-[#0f1729] border border-[#1e2d45] rounded-md px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#243552] transition-colors"
            >
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] font-semibold text-[#4a5f7a] mb-1.5 uppercase tracking-widest">
              Password {user && <span className="text-[#4a5f7a] normal-case font-normal">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={user ? 'New password (optional)' : 'Min 8 characters'}
                className="w-full bg-[#0f1729] border border-[#1e2d45] rounded-md px-3 py-2 pr-9 text-[12px] text-white placeholder-[#4a5f7a] focus:outline-none focus:border-[#243552] transition-colors"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2.5 top-2 text-[#4a5f7a] hover:text-[#94a3b8]">
                {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          {form.password && (
            <div>
              <label className="block text-[10px] font-semibold text-[#4a5f7a] mb-1.5 uppercase tracking-widest">Confirm Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Repeat password"
                  className="w-full bg-[#0f1729] border border-[#1e2d45] rounded-md px-3 py-2 pr-9 text-[12px] text-white placeholder-[#4a5f7a] focus:outline-none focus:border-[#243552] transition-colors"
                />
                {form.confirmPassword && (
                  <span className={`absolute right-2.5 top-2 ${form.password === form.confirmPassword ? 'text-[#10b981]' : 'text-red-400'}`}>
                    {form.password === form.confirmPassword ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-md border border-[#1e2d45] text-[11px] font-medium text-[#94a3b8] hover:border-[#243552] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-md bg-[#3b82f6] hover:bg-[#2563eb] text-[11px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading
                ? <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
        <div className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-md border text-[11px] font-medium shadow-md ${
          toast.type === 'success'
            ? 'bg-[#0b1120] border-[#10b981]/30 text-[#10b981]'
            : 'bg-[#0b1120] border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Page Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d45] bg-[#0b1120]">
        <div>
          <h1 className="text-sm font-semibold text-white">User Management</h1>
          <p className="text-[11px] text-[#4a5f7a] mt-0.5">Manage team members, roles, and access control</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchUsers}
            className="p-1.5 rounded-md border border-[#1e2d45] hover:border-[#243552] text-[#4a5f7a] hover:text-[#94a3b8] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setEditUser(null); setShowModal(true); }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[11px] font-medium transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">

        {/* ── KPI Row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 divide-x divide-[#1e2d45] border border-[#1e2d45] rounded-md bg-[#0b1120] overflow-hidden">
          {[
            { role: 'ADMIN', label: 'Administrators', count: roleCounts.ADMIN, desc: 'Full system access', colorClass: 'text-red-400' },
            { role: 'MANAGER', label: 'Managers', count: roleCounts.MANAGER, desc: 'Operations access', colorClass: 'text-amber-400' },
            { role: 'STAFF', label: 'Staff Members', count: roleCounts.STAFF, desc: 'View & basic access', colorClass: 'text-[#3b82f6]' },
          ].map((card) => (
            <button
              key={card.role}
              onClick={() => setRoleFilter(roleFilter === card.role ? 'ALL' : card.role)}
              className={`px-4 py-3 text-left transition-colors hover:bg-[#0f1729] ${roleFilter === card.role ? 'bg-[#0f1729]' : ''}`}
            >
              <div className={`text-[10px] font-semibold tracking-widest uppercase mb-1 ${card.colorClass}`}>{card.label}</div>
              <div className="text-xl font-semibold text-white tabular-nums">{card.count}</div>
              <div className="text-[10px] text-[#4a5f7a] mt-0.5">{card.desc}</div>
            </button>
          ))}
        </div>

        {/* ── Search bar ───────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#4a5f7a]" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0b1120] border border-[#1e2d45] rounded-md pl-9 pr-4 py-2 text-[12px] text-[#cbd5e1] placeholder-[#4a5f7a] focus:outline-none focus:border-[#243552] transition-colors"
          />
        </div>

        {/* ── Users Data Table ─────────────────────────────────────────── */}
        <div className="bg-[#0b1120] border border-[#1e2d45] rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2d45] bg-[#0b1120]">
                  {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold tracking-widest text-[#4a5f7a] uppercase whitespace-nowrap ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#1e2d45]/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-[#0f1729] rounded animate-pulse" style={{ width: `${55 + Math.random() * 30}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <Users className="h-8 w-8 text-[#1e2d45] mx-auto mb-2" />
                      <p className="text-[11px] text-[#4a5f7a]">No users found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-b border-[#1e2d45]/50 hover:bg-[#0f1729] transition-colors ${u.id === currentUser?.id ? 'bg-[#3b82f6]/5' : ''}`}
                    >
                      {/* Name */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="h-6 w-6 rounded-sm bg-[#1e2d45] border border-[#243552] flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0">
                            {getInitials(u.name)}
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[12px] font-medium text-[#cbd5e1]">{u.name}</span>
                            {u.id === currentUser?.id && (
                              <span className="text-[9px] bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 px-1.5 py-0.5 rounded-sm font-semibold">YOU</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] text-[#4a5f7a]">{u.email}</span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${ROLE_COLORS[u.role]}`}>
                          {u.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20">
                          Active
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] text-[#4a5f7a]">
                          {new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => { setEditUser(u); setShowModal(true); }}
                            className="p-1.5 rounded-sm hover:bg-[#1e2d45] text-[#4a5f7a] hover:text-[#3b82f6] transition-colors"
                            title="Edit user"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {u.id !== currentUser?.id && (
                            deleteConfirm === u.id ? (
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => handleDelete(u.id)}
                                  className="p-1.5 rounded-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                  title="Confirm delete"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="p-1.5 rounded-sm hover:bg-[#1e2d45] text-[#4a5f7a] hover:text-[#94a3b8] transition-colors"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(u.id)}
                                className="p-1.5 rounded-sm hover:bg-[#1e2d45] text-[#4a5f7a] hover:text-red-400 transition-colors"
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
            <div className="px-4 py-2.5 border-t border-[#1e2d45] text-[10px] text-[#4a5f7a]">
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
