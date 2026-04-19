"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  Search,
  UserX,
  UserCheck,
  Loader2,
  ShieldCheck,
  User,
  Trash2,
  KeyRound,
} from "lucide-react";
import { staffApi, StaffMember } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

type View = "active" | "suspended" | "all";

const STAFF_ROLES = [
  {
    value: "COMPANY_SUPER_ADMIN",
    label: "Company Super Admin",
    description: "Full business operations access",
  },
  {
    value: "COMPANY_STAFF",
    label: "Company Staff",
    description: "Day-to-day operations access",
  },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:
    "bg-primary-700/20 text-primary-400 border border-primary-700/30",
  COMPANY_SUPER_ADMIN:
    "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  COMPANY_STAFF: "bg-ink-700 text-ink-300 border border-ink-600",
};

function RoleBadge({ role }: { role: string }) {
  const label = role.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
        ROLE_COLORS[role] ?? "bg-ink-700 text-ink-400"
      }`}
    >
      {label}
    </span>
  );
}

// ── Create Staff Modal ───────────────────────────────────────

function CreateStaffModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { success, error } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("COMPANY_STAFF");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Required";
    if (!lastName.trim()) errs.lastName = "Required";
    if (!email.trim()) errs.email = "Required";
    if (!role) errs.role = "Required";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await staffApi.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        role,
      });
      success(
        "Staff invited",
        `An invitation email has been sent to ${email.trim()}`,
      );
      onCreated();
    } catch (err) {
      error(
        "Failed to create staff",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite Staff Member"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary px-4">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary px-5"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Sending…
              </>
            ) : (
              "Send Invitation"
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="admin-label">First Name *</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="admin-input"
              placeholder="John"
            />
            {errors.firstName && (
              <p className="text-xs text-danger mt-1">{errors.firstName}</p>
            )}
          </div>
          <div>
            <label className="admin-label">Last Name *</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="admin-input"
              placeholder="Doe"
            />
            {errors.lastName && (
              <p className="text-xs text-danger mt-1">{errors.lastName}</p>
            )}
          </div>
        </div>
        <div>
          <label className="admin-label">Email Address *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="admin-input"
            placeholder="john@example.com"
          />
          {errors.email && (
            <p className="text-xs text-danger mt-1">{errors.email}</p>
          )}
        </div>
        <div>
          <label className="admin-label">Role *</label>
          <div className="space-y-2">
            {STAFF_ROLES.map((r) => (
              <label
                key={r.value}
                className="flex items-start gap-3 p-3 rounded-lg border border-ink-600 cursor-pointer hover:border-primary-600 transition-colors"
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                  className="accent-primary-600 mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-ink-200">{r.label}</p>
                  <p className="text-xs text-ink-500">{r.description}</p>
                </div>
              </label>
            ))}
          </div>
          {errors.role && (
            <p className="text-xs text-danger mt-1">{errors.role}</p>
          )}
        </div>
        <p className="text-xs text-ink-500 bg-ink-700/40 rounded-lg p-3 border border-ink-700">
          An invitation email will be sent. The staff member will set their own
          password via the link. The link expires in 48 hours.
        </p>
      </form>
    </Modal>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function StaffPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [view, setView] = useState<View>("active");
  const [createModal, setCreateModal] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await staffApi.list({
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          role: roleFilter || undefined,
          withDeleted: view === "all" || view === "suspended",
          suspendedOnly: view === "suspended",
        });
        setStaff(res.data.items);
        setTotal(res.data.total);
      } catch (err) {
        error(
          "Failed to load staff",
          err instanceof Error ? err.message : undefined,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, search, roleFilter, view, error],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function handleSuspend(member: StaffMember) {
    if (
      !confirm(
        `Suspend ${member.firstName} ${member.lastName}? They will be logged out immediately.`,
      )
    )
      return;
    setBusyId(member.id);
    try {
      await staffApi.suspend(member.id);
      success(
        "Staff suspended",
        `${member.firstName} ${member.lastName} can no longer log in.`,
      );
      load(true);
    } catch (err) {
      error(
        "Failed to suspend",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(member: StaffMember) {
    setBusyId(member.id);
    try {
      await staffApi.reactivate(member.id);
      success(
        "Staff reactivated",
        `${member.firstName} ${member.lastName} can log in again.`,
      );
      load(true);
    } catch (err) {
      error(
        "Failed to reactivate",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(member: StaffMember) {
    const confirmText = `delete ${member.email}`;
    const input = prompt(
      `PERMANENTLY delete ${member.firstName} ${member.lastName}?\n\nThis cannot be undone. To confirm, type exactly:\n\n${confirmText}`,
    );
    if (input !== confirmText) return;
    setBusyId(member.id);
    try {
      await staffApi.delete(member.id);
      success("Staff deleted", `${member.email} has been permanently removed.`);
      load(true);
    } catch (err) {
      error(
        "Failed to delete",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Staff</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {total} team member{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-ghost"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setCreateModal(true)}
              className="btn-primary"
            >
              <Plus size={15} /> Invite Staff
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="admin-card p-4 flex items-center gap-3 flex-wrap">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
            setPage(1);
          }}
          className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm"
        >
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none"
            />
            <input
              type="search"
              placeholder="Search name or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="admin-input pl-9"
            />
          </div>
          <button type="submit" className="btn-secondary px-3 py-2">
            <Search size={14} />
          </button>
        </form>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="admin-select"
        >
          <option value="">All Roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="COMPANY_SUPER_ADMIN">Company Super Admin</option>
          <option value="COMPANY_STAFF">Company Staff</option>
        </select>

        <div className="flex items-center rounded-md border border-ink-700 overflow-hidden">
          {(["active", "suspended", "all"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-primary-700 text-white"
                  : "bg-ink-800 text-ink-400 hover:text-ink-100 hover:bg-ink-700"
              }`}
            >
              {v === "active"
                ? "Active"
                : v === "suspended"
                  ? "Suspended"
                  : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={6} cols={7} />
          </div>
        ) : staff.length === 0 ? (
          <div className="py-20 text-center">
            <User size={36} className="text-ink-700 mx-auto mb-3" />
            <p className="text-sm text-ink-500">No staff members found</p>
            {isSuperAdmin && view === "active" && (
              <button
                onClick={() => setCreateModal(true)}
                className="btn-primary mt-4"
              >
                Invite first staff member
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th>Status</th>
                  <th>2FA</th>
                  <th>Last Login</th>
                  {isSuperAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => {
                  const isSelf = member.email === currentUser?.email;
                  const isTargetSuperAdmin = member.role === "SUPER_ADMIN";
                  const canAct = isSuperAdmin && !isSelf && !isTargetSuperAdmin;
                  const busy = busyId === member.id;
                  return (
                    <tr
                      key={member.id}
                      onClick={() => router.push(`/staff/${member.id}`)}
                      className={`cursor-pointer ${
                        !member.isActive ? "opacity-60" : ""
                      }`}
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-700/20 border border-primary-700/30 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary-400">
                              {member.firstName[0]}
                              {member.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink-200 leading-tight">
                              {member.firstName} {member.lastName}
                              {isSelf && (
                                <span className="ml-1.5 text-[10px] text-ink-600">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-ink-500">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <RoleBadge role={member.role} />
                      </td>
                      <td>
                        <span className="text-xs text-ink-400">
                          {member.permissions?.length ?? 0} granted
                        </span>
                      </td>
                      <td>
                        {member.isActive ? (
                          <span className="text-xs text-success font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs text-danger font-medium">
                            Suspended
                          </span>
                        )}
                        {!member.emailVerified && member.isActive && (
                          <span className="ml-1.5 text-[10px] text-warning">
                            (unverified)
                          </span>
                        )}
                      </td>
                      <td>
                        {member.twoFactorEnabled ? (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <ShieldCheck size={12} /> Enabled
                          </span>
                        ) : (
                          <span className="text-xs text-ink-600">—</span>
                        )}
                      </td>
                      <td className="text-xs text-ink-500 whitespace-nowrap">
                        {member.lastLoginAt ? (
                          format(
                            new Date(member.lastLoginAt),
                            "d MMM yyyy, HH:mm",
                          )
                        ) : (
                          <span className="text-ink-700">Never</span>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td onClick={(e) => e.stopPropagation()}>
                          {canAct ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  router.push(`/staff/${member.id}`)
                                }
                                className="btn-ghost p-1.5 text-ink-400 hover:text-primary-400"
                                title="Manage permissions"
                              >
                                <KeyRound size={13} />
                              </button>
                              {member.isActive ? (
                                <button
                                  onClick={() => handleSuspend(member)}
                                  disabled={busy}
                                  className="btn-ghost p-1.5 text-ink-400 hover:text-warning"
                                  title="Suspend"
                                >
                                  {busy ? (
                                    <Loader2
                                      size={13}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <UserX size={13} />
                                  )}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivate(member)}
                                  disabled={busy}
                                  className="btn-ghost p-1.5 text-ink-400 hover:text-success"
                                  title="Reactivate"
                                >
                                  {busy ? (
                                    <Loader2
                                      size={13}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <UserCheck size={13} />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(member)}
                                disabled={busy}
                                className="btn-ghost p-1.5 text-ink-400 hover:text-danger"
                                title="Delete permanently"
                              >
                                {busy ? (
                                  <Loader2
                                    size={13}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2 size={13} />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-ink-700">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-ink-700">
            <p className="text-xs text-ink-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost px-2 py-1 text-xs disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-xs text-ink-400 px-2">
                Page {page} of {Math.ceil(total / PAGE_SIZE)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * PAGE_SIZE >= total}
                className="btn-ghost px-2 py-1 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {createModal && (
        <CreateStaffModal
          onClose={() => setCreateModal(false)}
          onCreated={() => {
            setCreateModal(false);
            load(true);
          }}
        />
      )}
    </div>
  );
}
