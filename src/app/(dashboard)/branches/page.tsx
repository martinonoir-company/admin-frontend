"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  Building2,
  Edit3,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  branchesApi,
  Branch,
  BranchAddress,
  CreateBranchDto,
  UpdateBranchDto,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * The server returns 409 with a JSON body like:
 *   { error: 'BRANCH_HAS_DEPENDENCIES', message, blockers: {...} }
 * Our `request()` helper stringifies the message field. When the message
 * itself was the JSON body, parse it so we can render a useful explanation.
 */
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

function explainBlockers(blockers: Record<string, number | boolean>): string {
  const parts: string[] = [];
  if (blockers.isLastActiveBranch) {
    return "This is the last active branch. Create another before removing this one.";
  }
  if (typeof blockers.activeTerminals === "number" && blockers.activeTerminals > 0) {
    parts.push(`${blockers.activeTerminals} active terminal${blockers.activeTerminals === 1 ? "" : "s"}`);
  }
  if (typeof blockers.activeSessions === "number" && blockers.activeSessions > 0) {
    parts.push(`${blockers.activeSessions} active POS session${blockers.activeSessions === 1 ? "" : "s"}`);
  }
  if (typeof blockers.openOrders === "number" && blockers.openOrders > 0) {
    parts.push(`${blockers.openOrders} unfulfilled order${blockers.openOrders === 1 ? "" : "s"}`);
  }
  if (typeof blockers.stockOnHand === "number" && blockers.stockOnHand > 0) {
    parts.push(`${blockers.stockOnHand} unit${blockers.stockOnHand === 1 ? "" : "s"} of stock at the warehouse`);
  }
  return parts.length
    ? `Resolve these first: ${parts.join(", ")}.`
    : "This branch has dependent records.";
}

// ─────────────────────────────────────────────────────────────
// Create / Edit modal
// ─────────────────────────────────────────────────────────────

interface BranchFormState {
  code: string;
  name: string;
  warehouseCode: string;
  phone: string;
  isActive: boolean;
  address: BranchAddress;
}

const EMPTY_FORM: BranchFormState = {
  code: "",
  name: "",
  warehouseCode: "",
  phone: "",
  isActive: true,
  address: {},
};

function BranchModal({
  branch,
  onClose,
  onSaved,
}: {
  branch: Branch | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!branch;
  const { success, error } = useToast();
  const [form, setForm] = useState<BranchFormState>(() =>
    branch
      ? {
          code: branch.code,
          name: branch.name,
          warehouseCode: branch.warehouseCode,
          phone: branch.phone ?? "",
          isActive: branch.isActive,
          address: branch.address ?? {},
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setAddressField<K extends keyof BranchAddress>(
    key: K,
    value: BranchAddress[K],
  ) {
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const codeOk = /^[A-Z0-9][A-Z0-9-]{0,49}$/.test(form.code);
    const whOk = /^[A-Z0-9][A-Z0-9-]{0,99}$/.test(form.warehouseCode);
    if (!isEditing && !codeOk) {
      errs.code =
        "Uppercase letters, digits, and dashes only. Max 50 characters.";
    }
    if (!form.name.trim()) errs.name = "Required";
    if (!isEditing && !whOk) {
      errs.warehouseCode =
        "Uppercase letters, digits, and dashes only. Max 100 characters.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      // Strip empty optional address fields before sending.
      const cleanAddress: BranchAddress = {};
      const a = form.address;
      if (a.line1?.trim()) cleanAddress.line1 = a.line1.trim();
      if (a.line2?.trim()) cleanAddress.line2 = a.line2.trim();
      if (a.city?.trim()) cleanAddress.city = a.city.trim();
      if (a.state?.trim()) cleanAddress.state = a.state.trim();
      if (a.countryCode?.trim()) cleanAddress.countryCode = a.countryCode.trim().toUpperCase();
      if (a.postalCode?.trim()) cleanAddress.postalCode = a.postalCode.trim();
      const hasAddress = Object.keys(cleanAddress).length > 0;

      if (isEditing && branch) {
        const dto: UpdateBranchDto = {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          isActive: form.isActive,
        };
        if (hasAddress) dto.address = cleanAddress;
        await branchesApi.update(branch.id, dto);
        success("Branch updated", `${form.name} saved.`);
      } else {
        const dto: CreateBranchDto = {
          code: form.code.toUpperCase(),
          name: form.name.trim(),
          warehouseCode: form.warehouseCode.toUpperCase(),
          phone: form.phone.trim() || undefined,
        };
        if (hasAddress) dto.address = cleanAddress;
        await branchesApi.create(dto);
        success("Branch created", `${form.name} is ready.`);
      }
      onSaved();
      onClose();
    } catch (err) {
      error(
        isEditing ? "Failed to save branch" : "Failed to create branch",
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
      title={isEditing ? "Edit branch" : "New branch"}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            form="branch-form"
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
              "Create branch"
            )}
          </button>
        </>
      }
    >
      <form id="branch-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="admin-label">Code</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
              }
              disabled={isEditing}
              placeholder="LAGOS-VI"
              className="admin-input"
            />
            {isEditing ? (
              <p className="text-[11px] text-ink-500 mt-1">
                Code is immutable after creation.
              </p>
            ) : (
              errors.code && (
                <p className="text-xs text-danger mt-1">{errors.code}</p>
              )
            )}
          </div>
          <div>
            <label className="admin-label">Warehouse code</label>
            <input
              type="text"
              value={form.warehouseCode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  warehouseCode: e.target.value.toUpperCase(),
                }))
              }
              disabled={isEditing}
              placeholder="LAGOS-VI-WH"
              className="admin-input"
            />
            {isEditing ? (
              <p className="text-[11px] text-ink-500 mt-1">
                Warehouse code is immutable after creation.
              </p>
            ) : (
              errors.warehouseCode && (
                <p className="text-xs text-danger mt-1">
                  {errors.warehouseCode}
                </p>
              )
            )}
          </div>
        </div>

        <div>
          <label className="admin-label">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Lagos — Victoria Island"
            className="admin-input"
          />
          {errors.name && (
            <p className="text-xs text-danger mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="admin-label">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+234 ..."
            className="admin-input"
          />
        </div>

        <fieldset className="border border-ink-700 rounded-md p-3 space-y-3">
          <legend className="text-xs font-semibold text-ink-300 px-1">
            Address (optional)
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="admin-label">Line 1</label>
              <input
                type="text"
                value={form.address.line1 ?? ""}
                onChange={(e) => setAddressField("line1", e.target.value)}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Line 2</label>
              <input
                type="text"
                value={form.address.line2 ?? ""}
                onChange={(e) => setAddressField("line2", e.target.value)}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">City</label>
              <input
                type="text"
                value={form.address.city ?? ""}
                onChange={(e) => setAddressField("city", e.target.value)}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">State</label>
              <input
                type="text"
                value={form.address.state ?? ""}
                onChange={(e) => setAddressField("state", e.target.value)}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Country code</label>
              <input
                type="text"
                value={form.address.countryCode ?? ""}
                onChange={(e) =>
                  setAddressField(
                    "countryCode",
                    e.target.value.toUpperCase(),
                  )
                }
                placeholder="NG"
                maxLength={3}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">Postal code</label>
              <input
                type="text"
                value={form.address.postalCode ?? ""}
                onChange={(e) => setAddressField("postalCode", e.target.value)}
                className="admin-input"
              />
            </div>
          </div>
        </fieldset>

        {isEditing && (
          <label className="flex items-center gap-2 text-sm text-ink-200 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
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
// Main page
// ─────────────────────────────────────────────────────────────

export default function BranchesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage =
    user?.role === "SUPER_ADMIN" || user?.role === "COMPANY_SUPER_ADMIN";

  const load = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await branchesApi.list();
        setBranches(res.data);
      } catch (err) {
        error(
          "Failed to load branches",
          err instanceof Error ? err.message : undefined,
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [error],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(branch: Branch) {
    if (
      !confirm(
        `Remove "${branch.name}" (${branch.code})?\n\nThis is reversible only by re-creating the branch with the same code. Historical sales, inventory, and audit records remain intact.`,
      )
    )
      return;
    setBusyId(branch.id);
    try {
      await branchesApi.remove(branch.id);
      success("Branch removed", `${branch.name} has been deactivated.`);
      load(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const { blockers } = parseStructuredError(msg);
      if (blockers) {
        error("Cannot remove branch", explainBlockers(blockers));
      } else {
        error("Failed to remove branch", msg);
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Branches</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {branches.length} branch{branches.length === 1 ? "" : "es"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-ghost"
            title="Refresh"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
          </button>
          {canManage && (
            <button
              onClick={() => setCreateOpen(true)}
              className="btn-primary"
            >
              <Plus size={15} /> New branch
            </button>
          )}
        </div>
      </div>

      {/* Last-active warning */}
      {!loading && branches.filter((b) => b.isActive).length === 1 && (
        <div className="admin-card p-3 border-l-4 border-l-warning bg-warning/5 flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="text-warning shrink-0 mt-0.5"
          />
          <div>
            <p className="text-sm font-medium text-ink-100">
              Only one active branch
            </p>
            <p className="text-xs text-ink-400 mt-0.5">
              At least one active branch must always exist. The system will
              refuse to remove or deactivate the last one.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={4} cols={canManage ? 6 : 5} />
          </div>
        ) : branches.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 size={36} className="text-ink-700 mx-auto mb-3" />
            <p className="text-sm text-ink-500">No branches yet</p>
            {canManage && (
              <button
                onClick={() => setCreateOpen(true)}
                className="btn-primary mt-4"
              >
                Create first branch
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Code</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th>Phone</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => {
                  const busy = busyId === branch.id;
                  return (
                    <tr
                      key={branch.id}
                      onClick={() => router.push(`/branches/${branch.id}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-md bg-primary-700/20 border border-primary-700/30 flex items-center justify-center shrink-0">
                            <Building2
                              size={14}
                              className="text-primary-400"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink-200 leading-tight">
                              {branch.name}
                            </p>
                            <p className="text-xs text-ink-500">
                              {[
                                branch.address?.city,
                                branch.address?.state,
                                branch.address?.countryCode,
                              ]
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-mono text-ink-300">
                          {branch.code}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-mono text-ink-300">
                          {branch.warehouseCode}
                        </span>
                      </td>
                      <td>
                        {branch.isActive ? (
                          <span className="text-xs text-success font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs text-danger font-medium">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-ink-400">
                        {branch.phone ?? "—"}
                      </td>
                      {canManage && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditTarget(branch)}
                              className="btn-ghost p-1.5 text-ink-400 hover:text-primary-400"
                              title="Edit"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(branch)}
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

      {createOpen && (
        <BranchModal
          branch={null}
          onClose={() => setCreateOpen(false)}
          onSaved={() => load(true)}
        />
      )}
      {editTarget && (
        <BranchModal
          branch={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => load(true)}
        />
      )}
    </div>
  );
}
