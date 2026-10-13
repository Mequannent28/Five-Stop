import React, { useEffect, useState } from 'react';
import { Plus, Users as UsersIcon, Phone, Send, Pencil, X } from 'lucide-react';
import api from '../api/axios';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';

const emptyForm = {
  name: '', email: '', password: '', role: 'storekeeper',
  phone: '', telegramChatId: '',
};

const roleColor  = { admin: 'brass', manager: 'green', storekeeper: 'ink' };

const Users = () => {
  const [users,      setUsers]      = useState([]);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editUser,   setEditUser]   = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [error,      setError]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(10);

  const load = () => api.get('/users')
    .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
    .catch(() => setUsers([]));

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      name:           u.name || '',
      email:          u.email || '',
      password:       '',
      role:           u.role || 'storekeeper',
      phone:          u.phone || '',
      telegramChatId: u.telegramChatId || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      if (editUser) {
        const payload = {
          name:           form.name,
          role:           form.role,
          phone:          form.phone,
          telegramChatId: form.telegramChatId,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editUser._id}`, payload);
      } else {
        await api.post('/auth/register', form);
      }
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save account.');
    } finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    await api.put(`/users/${u._id}`, { isActive: !u.isActive });
    load();
  };

  const paginated = users.slice((page - 1) * pageSize, page * pageSize);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Staff Accounts</h1>
          <p className="text-xs text-ink-400 mt-0.5">{users.length} registered account{users.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="brass" onClick={openCreate}>
          <Plus size={16} /> Add staff account
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead style={{ background: 'linear-gradient(90deg,#1e3a8a 0%,#1d4ed8 50%,#2563eb 100%)' }}>
              <tr>
                {['Name', 'Email', 'Phone', 'Telegram', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100"
                    style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-400">No accounts yet.</td></tr>
              )}
              {paginated.map(u => (
                <tr key={u._id} className="hover:bg-blue-50/20 transition-colors" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td className="px-4 py-3 font-semibold text-ink-900 whitespace-nowrap">{u.name}</td>
                  <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{u.email}</td>
                  <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">
                    {u.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} className="text-ink-400" /> {u.phone}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {u.telegramChatId ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        <Send size={9} /> Subscribed
                      </span>
                    ) : (
                      <span className="text-xs text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge color={roleColor[u.role]}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge color={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 px-2 py-1 text-xs font-semibold text-white transition">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => toggleActive(u)}
                        className={`text-xs font-semibold hover:underline ${u.isActive ? 'text-red-600' : 'text-emerald-600'}`}>
                        {u.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={users.length}
          onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
      </div>

      {/* ── Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editUser ? `Edit — ${editUser.name}` : 'Add Staff Account'}
        width="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              <X size={13} /> {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Full Name *</label>
            <input required value={form.name} onChange={e => f('name', e.target.value)}
              placeholder="e.g. Abebe Girma"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Email *</label>
            <input type="email" required={!editUser} value={form.email}
              onChange={e => f('email', e.target.value)}
              disabled={!!editUser}
              placeholder="abebe@hotel.com"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-ink-50 disabled:text-ink-400" />
          </div>

          {/* Phone + Telegram */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                <Phone size={11} className="inline mr-1" />Phone Number
              </label>
              <input value={form.phone} onChange={e => f('phone', e.target.value)}
                placeholder="+251 91 234 5678"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                <Send size={11} className="inline mr-1 text-sky-500" />Telegram Chat ID
              </label>
              <input value={form.telegramChatId} onChange={e => f('telegramChatId', e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <p className="text-[10px] text-ink-400 mt-0.5">Get from @userinfobot on Telegram</p>
            </div>
          </div>

          {/* Role + Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">Role *</label>
              <select value={form.role} onChange={e => f('role', e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                <option value="storekeeper">Store Keeper</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {editUser ? 'New Password (leave blank to keep)' : 'Temporary Password *'}
              </label>
              <input type="text" required={!editUser} minLength={6}
                value={form.password} onChange={e => f('password', e.target.value)}
                placeholder={editUser ? '••••••' : 'min 6 chars'}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          {form.telegramChatId && (
            <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-800">
              <Send size={11} className="inline mr-1" />
              This Chat ID will be automatically subscribed to Telegram notifications.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass" disabled={saving}>
              {saving ? 'Saving…' : (editUser ? 'Save Changes' : 'Create Account')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Users;
