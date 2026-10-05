import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Shield,
  Building,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
  Mail,
  Phone,
  MapPin,
  Coins,
  BadgeAlert,
  Sparkles,
  Layers,
  Check,
  Camera,
  Upload,
  Trash2,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const CAPABILITIES = [
  { key: 'recordGoods', label: 'Record Goods Receiving (Cash/Credit GRV)' },
  { key: 'checkReview', label: 'Check & Review Transactions (Stage 1)' },
  { key: 'approveGoods', label: 'Approve Goods & Vouchers (Stage 2)' },
  { key: 'postLedger', label: 'Post Documents to Ledger (Final Stage)' },
  { key: 'voidTransactions', label: 'Void / Reverse Transactions' },
  { key: 'viewReports', label: 'View Financial & Valuation Reports' },
  { key: 'manageAccounts', label: 'Manage Staff Accounts & Passwords' },
];

export default function Settings() {
  const { user, updateUser, hasRole, refreshPermissions } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'profile';

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // System settings state (Admin)
  const [systemForm, setSystemForm] = useState({
    hotelName: 'Five Stop',
    systemEmail: 'info@fivestop.com',
    phone: '+251 911 000 111',
    address: 'Addis Ababa, Ethiopia',
    currency: 'ETB',
    currencySymbol: 'ETB',
    lowStockThresholdDefault: 15,
    taxRate: 15,
    autoGenerateVoucherNo: true,
    allowNegativeStock: false,
    rolePermissions: {
      recordGoods: { storekeeper: true, manager: true, admin: true },
      checkReview: { storekeeper: false, manager: true, admin: true },
      approveGoods: { storekeeper: false, manager: false, admin: true },
      postLedger: { storekeeper: false, manager: true, admin: true },
      voidTransactions: { storekeeper: false, manager: false, admin: true },
      viewReports: { storekeeper: false, manager: true, admin: true },
      manageAccounts: { storekeeper: false, manager: false, admin: true }
    },
    notes: '',
  });
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemSaving, setSystemSaving] = useState(false);
  const [systemSuccess, setSystemSuccess] = useState('');
  const [systemError, setSystemError] = useState('');

  // Sync profile when user updates
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  // Load system settings
  useEffect(() => {
    if (user) {
      setSystemLoading(true);
      api
        .get('/settings')
        .then((res) => {
          if (res.data) {
            setSystemForm((prev) => ({ ...prev, ...res.data }));
          }
        })
        .catch((err) => console.error('Failed to load settings', err))
        .finally(() => setSystemLoading(false));
    }
  }, [user]);

  // Handle Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess('');
    setProfileError('');

    try {
      const res = await api.put('/auth/profile', profileForm);
      updateUser(res.data);
      setProfileSuccess('Profile details successfully updated.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Profile Photo Upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file (PNG, JPG, or WEBP).');
      return;
    }

    setAvatarUploading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      // Compress image client-side to max 500x500 JPEG
      const compressedBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const maxWidth = 500;
            const maxHeight = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = reject;
        };
        reader.onerror = reject;
      });

      const res = await api.put('/auth/profile', { avatar: compressedBase64 });
      updateUser(res.data);
      setProfileSuccess('Profile photo updated successfully!');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to upload profile photo.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  // Handle Remove Profile Photo
  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;
    setAvatarUploading(true);
    setProfileError('');
    try {
      const res = await api.put('/auth/profile', { avatar: '' });
      updateUser(res.data);
      setProfileSuccess('Profile photo removed.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to remove profile photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  // Handle Password Update
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordSuccess('');
    setPasswordError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      setPasswordSaving(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      setPasswordSaving(false);
      return;
    }

    try {
      await api.put('/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess('Password successfully updated!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Handle System Settings Update
  const handleSystemSubmit = async (e) => {
    e.preventDefault();
    setSystemSaving(true);
    setSystemSuccess('');
    setSystemError('');

    try {
      const res = await api.put('/settings', systemForm);
      setSystemForm((prev) => ({ ...prev, ...res.data }));
      if (res.data?.rolePermissions) {
        await refreshPermissions(res.data.rolePermissions);
      } else {
        await refreshPermissions();
      }
      setSystemSuccess('Five Stop system settings & role permissions saved and activated immediately.');
      setTimeout(() => setSystemSuccess(''), 4000);
    } catch (err) {
      setSystemError(err.response?.data?.message || 'Failed to update system settings.');
    } finally {
      setSystemSaving(false);
    }
  };

  const roleBadgeColor = {
    admin: 'bg-brass-100 text-brass-800 border-brass-300',
    manager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    storekeeper: 'bg-blue-50 text-blue-700 border-blue-200',
  }[user?.role || 'storekeeper'];

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Account &amp; System Settings
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Manage your personal credentials, profile identity, and Five Stop hotel management configurations
        </p>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-ink-100 space-x-1 sm:space-x-4 overflow-x-auto">
        <button
          onClick={() => setTab('profile')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${
            currentTab === 'profile'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-ink-400 hover:text-ink-700'
          }`}
        >
          <User size={16} /> My Profile
        </button>

        <button
          onClick={() => setTab('security')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${
            currentTab === 'security'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-ink-400 hover:text-ink-700'
          }`}
        >
          <Shield size={16} /> Security &amp; Password
        </button>

        {hasRole('admin') && (
          <button
            onClick={() => setTab('system')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${
              currentTab === 'system'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-ink-400 hover:text-ink-700'
            }`}
          >
            <Building size={16} /> Hotel &amp; System Config
          </button>
        )}

        <button
          onClick={() => setTab('permissions')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${
            currentTab === 'permissions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-ink-400 hover:text-ink-700'
          }`}
        >
          <Layers size={16} /> Role Privileges
        </button>
      </div>

      {/* ── Tab 1: Profile ── */}
      {currentTab === 'profile' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Identity Card */}
          <Card className="lg:col-span-1 flex flex-col items-center text-center p-6">
            {/* Avatar with Photo Upload */}
            <div className="relative mb-3 group">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-3xl font-black text-white shadow-md overflow-hidden ring-4 ring-white border border-ink-100">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user?.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user?.name?.[0]?.toUpperCase() || 'U'
                )}
              </div>

              {/* Upload Badge Button */}
              <label
                className={`absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-white transition hover:bg-blue-700 hover:scale-105 ${
                  avatarUploading ? 'animate-pulse pointer-events-none opacity-80' : ''
                }`}
                title="Upload profile photo"
              >
                <Camera size={15} />
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
              </label>
            </div>

            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2 mb-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-xs hover:bg-ink-50 hover:border-ink-300 transition">
                <Upload size={12} className="text-blue-600" />
                {avatarUploading ? 'Uploading...' : user?.avatar ? 'Change Photo' : 'Upload Photo'}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
              </label>

              {user?.avatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition"
                  title="Remove profile photo"
                >
                  <Trash2 size={11} /> Remove
                </button>
              )}
            </div>

            <h3 className="font-display text-lg font-bold text-ink-900">{user?.name}</h3>
            <p className="text-xs text-ink-400 mt-0.5">{user?.email}</p>

            <span className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize ${roleBadgeColor}`}>
              {user?.role} Account
            </span>

            <div className="mt-6 w-full border-t border-ink-100 pt-4 text-left text-xs space-y-2.5 text-ink-500">
              <div className="flex justify-between">
                <span>Account Status:</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Active
                </span>
              </div>
              <div className="flex justify-between">
                <span>Enterprise:</span>
                <span className="font-semibold text-ink-800">Five Stop</span>
              </div>
              <div className="flex justify-between">
                <span>Contact Phone:</span>
                <span className="font-semibold text-ink-800">{user?.phone || 'Not specified'}</span>
              </div>
            </div>
          </Card>

          {/* Edit Profile Form */}
          <Card className="lg:col-span-2">
            <h3 className="font-display text-base font-bold text-ink-900 mb-1">
              Personal Information
            </h3>
            <p className="text-xs text-ink-400 mb-5">
              Update your display name and email address used for sign-in and audit logs
            </p>

            {profileSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}
            {profileError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Hotel Admin"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Email Address (Login Account)
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="admin@hotel.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Contact Phone Number
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="+251 911 000 000"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={profileSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Save size={15} /> {profileSaving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Tab 2: Security & Password ── */}
      {currentTab === 'security' && (
        <div className="max-w-2xl">
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                <KeyRound size={16} />
              </span>
              <h3 className="font-display text-base font-bold text-ink-900">
                Change Password
              </h3>
            </div>
            <p className="text-xs text-ink-400 mb-5">
              Ensure your account uses a secure password to protect stock transactions and sign-offs
            </p>

            {passwordSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Repeat new password"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500 space-y-1">
                <p className="font-semibold text-ink-700">Security Recommendation:</p>
                <p>• Avoid reusing common passwords.</p>
                <p>• Remember that this password is also used for voucher check, approval, and receipt gates.</p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={passwordSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Lock size={15} /> {passwordSaving ? 'Updating…' : 'Update Password'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Tab 3: Hotel & System Config (Admin Only) ── */}
      {currentTab === 'system' && hasRole('admin') && (
        <Card className="max-w-3xl">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-brass-100 p-1.5 text-brass-700">
                <Building size={16} />
              </span>
              <h3 className="font-display text-base font-bold text-ink-900">
                Hotel &amp; Inventory Parameters
              </h3>
            </div>
            <span className="rounded-full bg-brass-50 border border-brass-200 px-2.5 py-0.5 text-xs font-bold text-brass-800">
              Admin Exclusive
            </span>
          </div>
          <p className="text-xs text-ink-400 mb-6">
            Configure hotel branding, currency symbols, and default stock safety thresholds
          </p>

          {systemSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
              <CheckCircle2 size={16} className="flex-shrink-0" />
              <span>{systemSuccess}</span>
            </div>
          )}
          {systemError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{systemError}</span>
            </div>
          )}

          <form onSubmit={handleSystemSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Hotel / Brand Name
                </label>
                <div className="relative">
                  <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="text"
                    required
                    value={systemForm.hotelName}
                    onChange={(e) => setSystemForm({ ...systemForm, hotelName: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                    placeholder="Five Stop"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Currency Symbol / Code
                </label>
                <div className="relative">
                  <Coins size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="text"
                    required
                    value={systemForm.currency}
                    onChange={(e) => setSystemForm({ ...systemForm, currency: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                    placeholder="ETB"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Official Contact Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="email"
                    value={systemForm.systemEmail}
                    onChange={(e) => setSystemForm({ ...systemForm, systemEmail: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                    placeholder="info@fivestop.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Official Phone
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="text"
                    value={systemForm.phone}
                    onChange={(e) => setSystemForm({ ...systemForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                    placeholder="+251 911 000 111"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Physical Address / Location
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="text"
                    value={systemForm.address}
                    onChange={(e) => setSystemForm({ ...systemForm, address: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                    placeholder="Addis Ababa, Ethiopia"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Default Low Stock Safety Threshold (Units)
                </label>
                <input
                  type="number"
                  min={1}
                  value={systemForm.lowStockThresholdDefault}
                  onChange={(e) => setSystemForm({ ...systemForm, lowStockThresholdDefault: Number(e.target.value) })}
                  className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Applicable VAT / Tax Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={systemForm.taxRate}
                  onChange={(e) => setSystemForm({ ...systemForm, taxRate: Number(e.target.value) })}
                  className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2 border-t border-ink-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemForm.autoGenerateVoucherNo}
                  onChange={(e) => setSystemForm({ ...systemForm, autoGenerateVoucherNo: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-xs font-semibold text-ink-900">Auto-generate Voucher Numbers</p>
                  <p className="text-[11px] text-ink-400">Automatically creates serial voucher codes (e.g. CGRV-2026-001) if left blank</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemForm.allowNegativeStock}
                  onChange={(e) => setSystemForm({ ...systemForm, allowNegativeStock: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-xs font-semibold text-ink-900">Permit Negative Stock Quantities</p>
                  <p className="text-[11px] text-ink-400">Allows issuing or disposing stock even when logged balance is below zero</p>
                </div>
              </label>
            </div>

            <div className="pt-3 flex justify-end">
              <Button type="submit" disabled={systemSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Save size={15} /> {systemSaving ? 'Saving Settings…' : 'Save Hotel Settings'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Tab 4: Role Privileges ── */}
      {currentTab === 'permissions' && (
        <Card className="max-w-3xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
              <Shield size={16} />
            </span>
            <h3 className="font-display text-base font-bold text-ink-900">
              System Roles &amp; Permissions Matrix
            </h3>
          </div>
          <p className="text-xs text-ink-400 mb-5">
            Your current assigned role is <strong className="capitalize text-ink-800">{user?.role}</strong>.
            {hasRole('admin') ? ' You can modify the system permissions below.' : ' You do not have permission to modify these settings.'}
          </p>

          <form onSubmit={handleSystemSubmit}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/70 text-ink-600 font-semibold">
                    <th className="py-2.5 px-3">System Capability</th>
                    <th className="py-2.5 px-3 text-center">Storekeeper</th>
                    <th className="py-2.5 px-3 text-center">Manager</th>
                    <th className="py-2.5 px-3 text-center">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {CAPABILITIES.map((cap) => (
                    <tr key={cap.key}>
                      <td className="py-2.5 px-3 font-medium">{cap.label}</td>
                      {['storekeeper', 'manager', 'admin'].map((r) => (
                        <td key={r} className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            disabled={!hasRole('admin')}
                            checked={systemForm.rolePermissions?.[cap.key]?.[r] || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSystemForm(prev => ({
                                ...prev,
                                rolePermissions: {
                                  ...prev.rolePermissions,
                                  [cap.key]: {
                                    ...prev.rolePermissions?.[cap.key],
                                    [r]: checked
                                  }
                                }
                              }));
                            }}
                            className="h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasRole('admin') && (
              <div className="pt-5 flex justify-end">
                <Button type="submit" disabled={systemSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Save size={15} /> {systemSaving ? 'Saving Permissions…' : 'Save Role Permissions'}
                </Button>
              </div>
            )}
            
            {systemSuccess && currentTab === 'permissions' && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>{systemSuccess}</span>
              </div>
            )}
            {systemError && currentTab === 'permissions' && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{systemError}</span>
              </div>
            )}
          </form>
        </Card>
      )}
    </div>
  );
}
