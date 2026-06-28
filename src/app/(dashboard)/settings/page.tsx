"use client";

import { useEffect, useState, useCallback } from "react";
import { User, Lock, Save, Loader2, Eye, EyeOff, CheckCircle2, ShieldCheck, Store } from "lucide-react";
import { accountApi, settingsApi, UserProfile } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { format } from "date-fns";

// ── Profile Section ──────────────────────────────────────────

function ProfileSection({ profile, onUpdated }: { profile: UserProfile; onUpdated: (p: UserProfile) => void }) {
  const { success, error } = useToast();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Required";
    if (!lastName.trim()) errs.lastName = "Required";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const res = await accountApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
      });
      onUpdated(res.data);
      success("Profile updated", "Your details have been saved.");
    } catch (err) {
      error("Failed to update profile", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Avatar strip */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-ink-700/30 border border-ink-700">
        <div className="w-14 h-14 rounded-full bg-primary-700/20 border border-primary-700/30 flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-primary-400">
            {firstName.charAt(0)}{lastName.charAt(0)}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-200">{firstName} {lastName}</p>
          <p className="text-xs text-ink-500">{profile.email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-700/20 text-primary-400 border border-primary-700/30">
            {profile.role}
          </span>
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="admin-label">First Name *</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="admin-input"
            placeholder="First name"
          />
          {errors.firstName && <p className="text-xs text-danger mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="admin-label">Last Name *</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="admin-input"
            placeholder="Last name"
          />
          {errors.lastName && <p className="text-xs text-danger mt-1">{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <label className="admin-label">Email Address</label>
        <input
          type="email"
          value={profile.email}
          disabled
          className="admin-input opacity-50 cursor-not-allowed"
        />
        <p className="text-[11px] text-ink-600 mt-1">Email address cannot be changed here.</p>
      </div>

      <div>
        <label className="admin-label">Phone Number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="admin-input"
          placeholder="+234 800 000 0000"
        />
      </div>

      <div className="pt-2 flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary px-6">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Profile</>}
        </button>
      </div>
    </form>
  );
}

// ── Password Section ─────────────────────────────────────────

function PasswordSection() {
  const { success, error } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!current) errs.current = "Enter your current password";
    if (!next) errs.next = "Enter a new password";
    else if (next.length < 8) errs.next = "Must be at least 8 characters";
    if (!confirm) errs.confirm = "Confirm your new password";
    else if (confirm !== next) errs.confirm = "Passwords do not match";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await accountApi.changePassword({ currentPassword: current, newPassword: next });
      success("Password changed", "Your password has been updated successfully.");
      setDone(true);
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(() => setDone(false), 5000);
    } catch (err) {
      error("Failed to change password", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  // Password strength
  const strength = (() => {
    if (!next) return 0;
    let s = 0;
    if (next.length >= 8) s++;
    if (/[A-Z]/.test(next)) s++;
    if (/[0-9]/.test(next)) s++;
    if (/[^A-Za-z0-9]/.test(next)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-danger", "bg-warning", "bg-primary-500", "bg-success"][strength];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {done && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          <CheckCircle2 size={16} />
          Password updated successfully.
        </div>
      )}

      <div>
        <label className="admin-label">Current Password *</label>
        <div className="relative">
          <input
            type={showCurrent ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="admin-input pr-10"
            placeholder="Your current password"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
          >
            {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.current && <p className="text-xs text-danger mt-1">{errors.current}</p>}
      </div>

      <div>
        <label className="admin-label">New Password *</label>
        <div className="relative">
          <input
            type={showNext ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="admin-input pr-10"
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowNext((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
          >
            {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {next && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1 h-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${strength >= i ? strengthColor : "bg-ink-700"}`}
                />
              ))}
            </div>
            <p className={`text-[11px] font-medium ${["", "text-danger", "text-warning", "text-primary-400", "text-success"][strength]}`}>
              {strengthLabel}
            </p>
          </div>
        )}
        {errors.next && <p className="text-xs text-danger mt-1">{errors.next}</p>}
      </div>

      <div>
        <label className="admin-label">Confirm New Password *</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="admin-input"
          placeholder="Repeat your new password"
          autoComplete="new-password"
        />
        {errors.confirm && <p className="text-xs text-danger mt-1">{errors.confirm}</p>}
      </div>

      <div className="pt-2 flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary px-6">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Changing…</> : <><ShieldCheck size={14} /> Change Password</>}
        </button>
      </div>
    </form>
  );
}

// ── Store Settings (super admin) ─────────────────────────────

function StoreSettingsSection() {
  const { success, error } = useToast();
  const [minQty, setMinQty] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    settingsApi
      .get()
      .then((res) => {
        if (!cancelled) setMinQty(String(res.data.wholesaleMinQty));
      })
      .catch((err) =>
        error("Failed to load settings", err instanceof Error ? err.message : undefined),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [error]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(minQty, 10);
    if (!Number.isFinite(n) || n < 1) {
      error("Invalid value", "Wholesale minimum quantity must be at least 1.");
      return;
    }
    setSaving(true);
    try {
      const res = await settingsApi.setWholesaleMinQty(n);
      setMinQty(String(res.data.wholesaleMinQty));
      success("Saved", `Wholesale minimum quantity is now ${res.data.wholesaleMinQty}.`);
    } catch (err) {
      error("Failed to save", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} height={44} />)}</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-ink-200 mb-1">Wholesale</h3>
        <p className="text-xs text-ink-500 mb-3">
          The minimum quantity a customer must order per item to buy at the
          wholesale price. Applied on the web and mobile storefronts and
          enforced at checkout.
        </p>
        <label className="block text-xs font-medium text-ink-400 mb-1.5">
          Minimum order quantity
        </label>
        <input
          type="number"
          min={1}
          value={minQty}
          onChange={(e) => setMinQty(e.target.value.replace(/[^0-9]/g, ""))}
          className="admin-input w-40"
        />
      </div>
      <button type="submit" disabled={saving} className="btn-primary px-6">
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
      </button>
    </form>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function SettingsPage() {
  const { error } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "store">("profile");

  const loadProfile = useCallback(async () => {
    try {
      const res = await accountApi.profile();
      setProfile(res.data);
    } catch (err) {
      error("Failed to load profile", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // The Store tab (wholesale config) is super-admin only; the server also
  // enforces settings:update, so this is a UX gate, not the security gate.
  const canEditStore = profile?.role === "SUPER_ADMIN";
  const tabs = [
    { key: "profile" as const, label: "Profile", icon: User },
    { key: "security" as const, label: "Security", icon: Lock },
    ...(canEditStore
      ? [{ key: "store" as const, label: "Store", icon: Store }]
      : []),
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Settings</h1>
        <p className="text-sm text-ink-500 mt-0.5">Manage your account and security preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-700">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? "border-primary-500 text-primary-400"
                : "border-transparent text-ink-500 hover:text-ink-200"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="admin-card p-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={44} />)}
          </div>
        ) : !profile ? (
          <p className="text-sm text-ink-500">Unable to load profile.</p>
        ) : activeTab === "profile" ? (
          <ProfileSection profile={profile} onUpdated={setProfile} />
        ) : activeTab === "store" && canEditStore ? (
          <StoreSettingsSection />
        ) : (
          <PasswordSection />
        )}
      </div>

      {/* Account meta */}
      {profile && (
        <div className="admin-card p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-0.5">
            <p className="text-xs text-ink-500">Account ID</p>
            <p className="font-mono text-xs text-ink-400">{profile.id}</p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-xs text-ink-500">Member since</p>
            <p className="text-xs text-ink-400">{format(new Date(profile.createdAt), "d MMMM yyyy")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
