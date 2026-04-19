"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Loader2,
  ShieldCheck,
  Square,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  staffApi,
  StaffMember,
  Permission,
  PERMISSION_GROUPS,
} from "@/lib/api";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:
    "bg-primary-700/20 text-primary-400 border border-primary-700/30",
  COMPANY_SUPER_ADMIN:
    "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  COMPANY_STAFF: "bg-ink-700 text-ink-300 border border-ink-600",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
        ROLE_COLORS[role] ?? "bg-ink-700 text-ink-400"
      }`}
    >
      {role.replace(/_/g, " ")}
    </span>
  );
}

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();

  const [member, setMember] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  // Permission flags currently being toggled (prevents duplicate clicks).
  const [pendingPerms, setPendingPerms] = useState<Set<Permission>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<
    null | "enable-all" | "disable-all" | "suspend" | "reactivate" | "delete"
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staffApi.get(id);
      setMember(res.data);
    } catch (err) {
      error(
        "Failed to load staff member",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [id, error]);

  useEffect(() => {
    load();
  }, [load]);

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isSelf = member?.email === currentUser?.email;
  const targetIsSuperAdmin = member?.role === "SUPER_ADMIN";
  const canEdit = !!(isSuperAdmin && !isSelf && !targetIsSuperAdmin);

  async function handleTogglePermission(perm: Permission, granted: boolean) {
    if (!member || !canEdit) return;
    if (pendingPerms.has(perm)) return;

    setPendingPerms((s) => {
      const next = new Set(s);
      next.add(perm);
      return next;
    });
    // Optimistic update: flip locally first, roll back on failure.
    const previous = member.permissions ?? [];
    const nextPerms = granted
      ? Array.from(new Set([...previous, perm]))
      : previous.filter((p) => p !== perm);
    setMember({ ...member, permissions: nextPerms });

    try {
      const res = await staffApi.togglePermission(member.id, perm, granted);
      setMember(res.data);
    } catch (err) {
      setMember({ ...member, permissions: previous });
      error(
        "Failed to update permission",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setPendingPerms((s) => {
        const next = new Set(s);
        next.delete(perm);
        return next;
      });
    }
  }

  async function handleEnableAll() {
    if (!member || !canEdit) return;
    setBulkBusy("enable-all");
    try {
      const res = await staffApi.enableAllPermissions(member.id);
      setMember(res.data);
      success("All permissions granted");
    } catch (err) {
      error(
        "Failed to enable all",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleDisableAll() {
    if (!member || !canEdit) return;
    if (
      !confirm(
        `Revoke ALL permissions from ${member.firstName} ${member.lastName}? They will lose access to every admin action.`,
      )
    )
      return;
    setBulkBusy("disable-all");
    try {
      const res = await staffApi.disableAllPermissions(member.id);
      setMember(res.data);
      success("All permissions revoked");
    } catch (err) {
      error(
        "Failed to disable all",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleSuspend() {
    if (!member || !canEdit) return;
    if (
      !confirm(
        `Suspend ${member.firstName} ${member.lastName}? They will be logged out immediately.`,
      )
    )
      return;
    setBulkBusy("suspend");
    try {
      await staffApi.suspend(member.id);
      success(
        "Staff suspended",
        `${member.firstName} ${member.lastName} can no longer log in.`,
      );
      await load();
    } catch (err) {
      error(
        "Failed to suspend",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleReactivate() {
    if (!member || !canEdit) return;
    setBulkBusy("reactivate");
    try {
      await staffApi.reactivate(member.id);
      success(
        "Staff reactivated",
        `${member.firstName} ${member.lastName} can log in again.`,
      );
      await load();
    } catch (err) {
      error(
        "Failed to reactivate",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleDelete() {
    if (!member || !canEdit) return;
    const confirmText = `delete ${member.email}`;
    const input = prompt(
      `PERMANENTLY delete ${member.firstName} ${member.lastName}?\n\nThis cannot be undone. To confirm, type exactly:\n\n${confirmText}`,
    );
    if (input !== confirmText) return;
    setBulkBusy("delete");
    try {
      await staffApi.delete(member.id);
      success("Staff deleted", `${member.email} has been permanently removed.`);
      router.push("/staff");
    } catch (err) {
      error(
        "Failed to delete",
        err instanceof Error ? err.message : undefined,
      );
      setBulkBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton width={36} height={36} />
          <div className="space-y-2">
            <Skeleton width={220} height={24} />
            <Skeleton width={160} height={14} />
          </div>
        </div>
        <SkeletonCard lines={5} />
        <SkeletonCard lines={10} />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="max-w-5xl mx-auto">
        <Link href="/staff" className="btn-ghost text-xs">
          <ArrowLeft size={14} /> Back to staff
        </Link>
        <p className="mt-4 text-sm text-ink-400">Staff member not found.</p>
      </div>
    );
  }

  const grantedSet = new Set(member.permissions ?? []);

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/staff" className="btn-ghost p-2">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-700/20 border border-primary-700/30 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-400">
                {member.firstName[0]}
                {member.lastName[0]}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-ink-100">
                  {member.firstName} {member.lastName}
                </h1>
                <RoleBadge role={member.role} />
                {member.isActive ? (
                  <span className="text-[10px] text-success font-semibold uppercase tracking-wide">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] text-danger font-semibold uppercase tracking-wide">
                    Suspended
                  </span>
                )}
                {member.twoFactorEnabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-success">
                    <ShieldCheck size={11} /> 2FA
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-500 mt-0.5">{member.email}</p>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            {member.isActive ? (
              <button
                onClick={handleSuspend}
                disabled={bulkBusy !== null}
                className="btn-secondary"
              >
                {bulkBusy === "suspend" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserX size={14} />
                )}
                Suspend
              </button>
            ) : (
              <button
                onClick={handleReactivate}
                disabled={bulkBusy !== null}
                className="btn-secondary"
              >
                {bulkBusy === "reactivate" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserCheck size={14} />
                )}
                Reactivate
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={bulkBusy !== null}
              className="btn-danger"
            >
              {bulkBusy === "delete" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard label="Joined">
          {format(new Date(member.createdAt), "d MMM yyyy")}
        </InfoCard>
        <InfoCard label="Last Login">
          {member.lastLoginAt
            ? format(new Date(member.lastLoginAt), "d MMM yyyy, HH:mm")
            : "Never"}
        </InfoCard>
        <InfoCard label="Email Verified">
          {member.emailVerified ? (
            <span className="text-success">Yes</span>
          ) : (
            <span className="text-warning">No</span>
          )}
        </InfoCard>
      </div>

      {/* Permissions */}
      <div className="admin-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-ink-700">
          <div>
            <h2 className="text-sm font-semibold text-ink-200">Permissions</h2>
            <p className="text-[11px] text-ink-500 mt-0.5">
              {member.permissions.length} of{" "}
              {PERMISSION_GROUPS.reduce(
                (n, g) => n + g.permissions.length,
                0,
              )}{" "}
              granted. Per-user overrides take precedence over role defaults.
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleEnableAll}
                disabled={bulkBusy !== null}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                {bulkBusy === "enable-all" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                Enable all
              </button>
              <button
                onClick={handleDisableAll}
                disabled={bulkBusy !== null}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                {bulkBusy === "disable-all" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Square size={12} />
                )}
                Disable all
              </button>
            </div>
          )}
        </div>

        {!canEdit && (
          <p className="text-xs text-ink-500 bg-ink-700/40 rounded-lg p-3 border border-ink-700">
            {isSelf
              ? "You cannot edit your own permissions."
              : targetIsSuperAdmin
                ? "SUPER_ADMIN permissions cannot be modified."
                : "Only SUPER_ADMIN can modify staff permissions."}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PERMISSION_GROUPS.map((group) => (
            <div
              key={group.label}
              className="rounded-lg border border-ink-700 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-ink-700">
                <h3 className="text-xs font-semibold text-ink-300 uppercase tracking-wider">
                  {group.label}
                </h3>
                <span className="text-[10px] text-ink-500">
                  {group.permissions.filter((p) => grantedSet.has(p)).length}/
                  {group.permissions.length}
                </span>
              </div>
              {group.permissions.map((perm) => {
                const checked = grantedSet.has(perm);
                const pending = pendingPerms.has(perm);
                return (
                  <label
                    key={perm}
                    className={`flex items-center justify-between gap-3 py-1 ${
                      canEdit ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                  >
                    <span className="text-xs text-ink-300 font-mono">
                      {perm}
                    </span>
                    <span className="relative inline-flex items-center">
                      {pending && (
                        <Loader2
                          size={11}
                          className="absolute -left-5 animate-spin text-primary-400"
                        />
                      )}
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canEdit || pending || bulkBusy !== null}
                        onChange={(e) =>
                          handleTogglePermission(perm, e.target.checked)
                        }
                        className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-primary-600 focus:ring-1 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-card p-4">
      <p className="text-[10px] text-ink-500 uppercase tracking-wider font-semibold">
        {label}
      </p>
      <p className="text-sm text-ink-200 font-medium mt-1">{children}</p>
    </div>
  );
}
