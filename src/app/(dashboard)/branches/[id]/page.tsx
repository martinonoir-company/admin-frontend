"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  Users,
  Monitor,
  Search,
  UserPlus,
  UserMinus,
  Building2,
} from "lucide-react";
import {
  branchesApi,
  staffApi,
  Branch,
  Terminal,
  BranchStaffMember,
  StaffMember,
  CreateTerminalDto,
  UpdateTerminalDto,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function parseStructuredError(msg: string): {
  blockers?: Record<string, number | boolean>;
} {
  try {
    const parsed = JSON.parse(msg);
    if (parsed && typeof parsed === "object" && parsed.blockers) {
      return { blockers: parsed.blockers };
    }
  } catch {
    /* not JSON */
  }
  return {};
}

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

// ─────────────────────────────────────────────────────────────
// Terminal modal
// ─────────────────────────────────────────────────────────────

function TerminalModal({
  branchId,
  terminal,
  onClose,
  onSaved,
}: {
  branchId: string;
  terminal: Terminal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!terminal;
  const { success, error } = useToast();
  const [code, setCode] = useState(terminal?.code ?? "");
  const [name, setName] = useState(terminal?.name ?? "");
  const [isActive, setIsActive] = useState(terminal?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!isEditing && !/^[A-Z0-9][A-Z0-9-]{0,49}$/.test(code)) {
      errs.code = "Uppercase letters, digits, and dashes only. Max 50 chars.";
    }
    if (!name.trim()) errs.name = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEditing && terminal) {
        const dto: UpdateTerminalDto = {
          name: name.trim(),
          isActive,
        };
        await branchesApi.updateTerminal(branchId, terminal.id, dto);
        success("Terminal updated", `${name} saved.`);
      } else {
        const dto: CreateTerminalDto = {
          code: code.toUpperCase(),
          name: name.trim(),
        };
        await branchesApi.createTerminal(branchId, dto);
        success("Terminal created", `${name} is ready.`);
      }
      onSaved();
      onClose();
    } catch (err) {
      error(
        isEditing ? "Failed to save terminal" : "Failed to create terminal",
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
      title={isEditing ? "Edit terminal" : "New terminal"}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            form="terminal-form"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving…
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Create terminal"
            )}
          </button>
        </>
      }
    >
      <form id="terminal-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="admin-label">Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={isEditing}
            placeholder="LAGOS-VI-POS-01"
            className="admin-input"
          />
          {isEditing ? (
            <p className="text-[11px] text-ink-500 mt-1">
              Code is immutable after creation. Historical sales reference it.
            </p>
          ) : (
            errors.code && (
              <p className="text-xs text-danger mt-1">{errors.code}</p>
            )
          )}
        </div>
        <div>
          <label className="admin-label">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Counter 1"
            className="admin-input"
          />
          {errors.name && (
            <p className="text-xs text-danger mt-1">{errors.name}</p>
          )}
        </div>
        {isEditing && (
          <label className="flex items-center gap-2 text-sm text-ink-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-primary-500"
            />
            Active
          </label>
        )}
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Assign-staff modal
// ─────────────────────────────────────────────────────────────

function AssignStaffModal({
  branchId,
  alreadyAssignedUserIds,
  onClose,
  onAssigned,
}: {
  branchId: string;
  alreadyAssignedUserIds: Set<string>;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { success, error } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staffApi.list({
        page: 1,
        limit: 25,
        search: search || undefined,
        // Customers cannot be assigned; the backend rejects them anyway.
        // We don't filter by role here so admins can assign any non-customer.
      });
      // Hide customers (defence in depth — server also rejects).
      const items = res.data.items.filter(
        (s) => s.role !== "CUSTOMER" && s.isActive,
      );
      setResults(items);
    } catch (err) {
      error(
        "Failed to load staff",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [search, error]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAssign(member: StaffMember) {
    setBusyId(member.id);
    try {
      await branchesApi.assignStaff(branchId, member.id);
      success("Assigned", `${member.firstName} ${member.lastName} added.`);
      onAssigned();
    } catch (err) {
      error(
        "Failed to assign",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal open onClose={onClose} title="Assign staff to branch" size="lg">
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none"
            />
            <input
              type="search"
              placeholder="Search by name or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="admin-input pl-9"
            />
          </div>
          <button type="submit" className="btn-secondary px-3 py-2">
            <Search size={14} />
          </button>
        </form>

        <div className="max-h-[400px] overflow-y-auto -mx-1">
          {loading ? (
            <div className="space-y-2 px-1">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-10">
              No staff matched.
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((member) => {
                const already = alreadyAssignedUserIds.has(member.id);
                const busy = busyId === member.id;
                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-ink-700/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-700/20 border border-primary-700/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary-400">
                        {member.firstName[0]}
                        {member.lastName[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-200 leading-tight truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-ink-500 truncate">
                        {member.email}
                      </p>
                    </div>
                    <RoleBadge role={member.role} />
                    {already ? (
                      <span className="text-xs text-ink-500 px-3">
                        Already assigned
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAssign(member)}
                        disabled={busy}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        {busy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <>
                            <UserPlus size={12} /> Assign
                          </>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

type Tab = "terminals" | "staff";

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [branch, setBranch] = useState<Branch | null>(null);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [staff, setStaff] = useState<BranchStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("terminals");

  const [terminalModal, setTerminalModal] = useState<{
    open: boolean;
    target: Terminal | null;
  }>({ open: false, target: null });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage =
    user?.role === "SUPER_ADMIN" || user?.role === "COMPANY_SUPER_ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, tRes, sRes] = await Promise.all([
        branchesApi.get(id),
        branchesApi.listTerminals(id),
        branchesApi.listStaff(id),
      ]);
      setBranch(bRes.data);
      setTerminals(tRes.data);
      setStaff(sRes.data);
    } catch (err) {
      error(
        "Failed to load branch",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [id, error]);

  useEffect(() => {
    load();
  }, [load]);

  const assignedUserIds = useMemo(
    () => new Set(staff.map((s) => s.userId)),
    [staff],
  );

  async function handleDeleteTerminal(terminal: Terminal) {
    if (
      !confirm(
        `Remove terminal "${terminal.name}" (${terminal.code})?\n\nHistorical sales referencing it remain intact.`,
      )
    )
      return;
    setBusyId(terminal.id);
    try {
      await branchesApi.removeTerminal(id, terminal.id);
      success("Terminal removed", `${terminal.name} has been deactivated.`);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const { blockers } = parseStructuredError(msg);
      if (blockers && typeof blockers.activeSessions === "number") {
        error(
          "Cannot remove terminal",
          `${blockers.activeSessions} active POS session${blockers.activeSessions === 1 ? "" : "s"}. Close them first.`,
        );
      } else {
        error("Failed to remove terminal", msg);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnassign(member: BranchStaffMember) {
    if (
      !confirm(
        `Remove ${member.firstName} ${member.lastName} from this branch?`,
      )
    )
      return;
    setBusyId(member.userId);
    try {
      await branchesApi.unassignStaff(id, member.userId);
      success("Removed", `${member.firstName} no longer assigned here.`);
      load();
    } catch (err) {
      error(
        "Failed to unassign",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="space-y-5 animate-fade-in">
        <Link
          href="/branches"
          className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
        >
          <ArrowLeft size={14} /> Branches
        </Link>
        <div className="admin-card p-10 text-center">
          <Building2 size={36} className="text-ink-700 mx-auto mb-3" />
          <p className="text-sm text-ink-400">Branch not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back */}
      <Link
        href="/branches"
        className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft size={14} /> Branches
      </Link>

      {/* Header card */}
      <div className="admin-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary-700/20 border border-primary-700/30 flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink-100">{branch.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-xs font-mono text-ink-400">
                  {branch.code}
                </span>
                <span className="text-xs text-ink-600">·</span>
                <span className="text-xs text-ink-400">
                  Warehouse:{" "}
                  <span className="font-mono text-ink-300">
                    {branch.warehouseCode}
                  </span>
                </span>
                <span className="text-xs text-ink-600">·</span>
                {branch.isActive ? (
                  <span className="text-xs text-success font-medium">
                    Active
                  </span>
                ) : (
                  <span className="text-xs text-danger font-medium">
                    Inactive
                  </span>
                )}
              </div>
              {(branch.address?.line1 ||
                branch.address?.city ||
                branch.phone) && (
                <p className="text-xs text-ink-500 mt-2">
                  {[
                    branch.address?.line1,
                    branch.address?.line2,
                    branch.address?.city,
                    branch.address?.state,
                    branch.address?.countryCode,
                    branch.address?.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  {branch.phone ? ` · ${branch.phone}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-ink-700">
        <button
          onClick={() => setTab("terminals")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            tab === "terminals"
              ? "border-primary-500 text-primary-400"
              : "border-transparent text-ink-400 hover:text-ink-100"
          }`}
        >
          <Monitor size={14} /> Terminals
          <span className="text-[10px] text-ink-500 font-normal">
            ({terminals.length})
          </span>
        </button>
        <button
          onClick={() => setTab("staff")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            tab === "staff"
              ? "border-primary-500 text-primary-400"
              : "border-transparent text-ink-400 hover:text-ink-100"
          }`}
        >
          <Users size={14} /> Staff
          <span className="text-[10px] text-ink-500 font-normal">
            ({staff.length})
          </span>
        </button>
      </div>

      {/* Terminals tab */}
      {tab === "terminals" && (
        <div className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <button
                onClick={() =>
                  setTerminalModal({ open: true, target: null })
                }
                className="btn-primary"
              >
                <Plus size={15} /> New terminal
              </button>
            </div>
          )}

          <div className="admin-card overflow-hidden">
            {terminals.length === 0 ? (
              <div className="py-16 text-center">
                <Monitor size={32} className="text-ink-700 mx-auto mb-3" />
                <p className="text-sm text-ink-500">
                  No terminals at this branch yet
                </p>
                {canManage && (
                  <button
                    onClick={() =>
                      setTerminalModal({ open: true, target: null })
                    }
                    className="btn-primary mt-4"
                  >
                    Create first terminal
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Terminal</th>
                      <th>Code</th>
                      <th>Status</th>
                      <th>Created</th>
                      {canManage && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {terminals.map((terminal) => {
                      const busy = busyId === terminal.id;
                      return (
                        <tr key={terminal.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-md bg-ink-700 border border-ink-600 flex items-center justify-center shrink-0">
                                <Monitor
                                  size={12}
                                  className="text-ink-400"
                                />
                              </div>
                              <span className="text-sm font-semibold text-ink-200">
                                {terminal.name}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="text-xs font-mono text-ink-300">
                              {terminal.code}
                            </span>
                          </td>
                          <td>
                            {terminal.isActive ? (
                              <span className="text-xs text-success font-medium">
                                Active
                              </span>
                            ) : (
                              <span className="text-xs text-danger font-medium">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="text-xs text-ink-500 whitespace-nowrap">
                            {format(
                              new Date(terminal.createdAt),
                              "d MMM yyyy",
                            )}
                          </td>
                          {canManage && (
                            <td>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() =>
                                    setTerminalModal({
                                      open: true,
                                      target: terminal,
                                    })
                                  }
                                  className="btn-ghost p-1.5 text-ink-400 hover:text-primary-400"
                                  title="Edit"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteTerminal(terminal)
                                  }
                                  disabled={busy}
                                  className="btn-ghost p-1.5 text-ink-400 hover:text-danger"
                                  title="Remove"
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
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Staff tab */}
      {tab === "staff" && (
        <div className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <button
                onClick={() => setAssignModalOpen(true)}
                className="btn-primary"
              >
                <UserPlus size={15} /> Assign staff
              </button>
            </div>
          )}

          <div className="admin-card overflow-hidden">
            {staff.length === 0 ? (
              <div className="py-16 text-center">
                <Users size={32} className="text-ink-700 mx-auto mb-3" />
                <p className="text-sm text-ink-500">
                  No staff assigned to this branch
                </p>
                {canManage && (
                  <button
                    onClick={() => setAssignModalOpen(true)}
                    className="btn-primary mt-4"
                  >
                    Assign first staff member
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
                      <th>Assigned</th>
                      {canManage && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member) => {
                      const busy = busyId === member.userId;
                      return (
                        <tr key={member.assignmentId}>
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
                          <td className="text-xs text-ink-500 whitespace-nowrap">
                            {format(
                              new Date(member.assignedAt),
                              "d MMM yyyy",
                            )}
                          </td>
                          {canManage && (
                            <td>
                              <button
                                onClick={() => handleUnassign(member)}
                                disabled={busy}
                                className="btn-ghost p-1.5 text-ink-400 hover:text-danger"
                                title="Remove from branch"
                              >
                                {busy ? (
                                  <Loader2
                                    size={13}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <UserMinus size={13} />
                                )}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {terminalModal.open && (
        <TerminalModal
          branchId={id}
          terminal={terminalModal.target}
          onClose={() => setTerminalModal({ open: false, target: null })}
          onSaved={() => load()}
        />
      )}
      {assignModalOpen && (
        <AssignStaffModal
          branchId={id}
          alreadyAssignedUserIds={assignedUserIds}
          onClose={() => setAssignModalOpen(false)}
          onAssigned={() => load()}
        />
      )}
    </div>
  );
}
