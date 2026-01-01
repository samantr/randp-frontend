import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "../common/Button";
import Input from "../common/Input";
import ConfirmDialog from "../common/ConfirmDialog";
import Modal from "../common/Modal";
import LookupTableModal from "../common/LookupTableModal";

import { getTransactionById } from "../../api/transactionsApi";
import {
  listAllocationsByTransaction,
  createAllocationFromTransaction,
  updateAllocationFromTransaction,
  deleteAllocationFromTransaction,
  listDebtCandidatesForTransaction,
} from "../../api/transactionAllocationsApi";

function moneyFa(v) {
  return Number(v || 0).toLocaleString("fa-IR");
}

function dateFa(v) {
  if (!v) return "-";
  return String(v).replace("T", " ").substring(0, 16);
}

function debtLabel(d) {
  if (!d) return "-";
  const title = d.personTitle || `#${d.id}`;
  return `${title} | جمع: ${moneyFa(d.totalAmount)} | مانده: ${moneyFa(d.remainingAmount)}`;
}

export default function TransactionAllocationsPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();

  const [loadingHeader, setLoadingHeader] = useState(false);
  const [tx, setTx] = useState(null);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [debtCandidates, setDebtCandidates] = useState([]);
  const debtMap = useMemo(() => {
    const m = {};
    for (const d of debtCandidates || []) m[d.id] = d;
    return m;
  }, [debtCandidates]);

  // create form
  const [debtId, setDebtId] = useState(null);
  const [amount, setAmount] = useState("");
  const [dsc, setDsc] = useState("");

  // create lookup modal
  const [debtLookupOpen, setDebtLookupOpen] = useState(false);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [editDebtCandidates, setEditDebtCandidates] = useState([]);
  const editDebtMap = useMemo(() => {
    const m = {};
    for (const d of editDebtCandidates || []) m[d.id] = d;
    return m;
  }, [editDebtCandidates]);

  const [editDebtId, setEditDebtId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDsc, setEditDsc] = useState("");

  // edit lookup modal
  const [editDebtLookupOpen, setEditDebtLookupOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const debtLookupColumns = useMemo(
    () => [
      { key: "personTitle", title: "شخص/سازمان", render: (r) => <span className="font-semibold">{r.personTitle || "-"}</span> },
      { key: "dateRegistered", title: "ثبت", render: (r) => dateFa(r.dateRegistered) },
      { key: "totalAmount", title: "جمع", render: (r) => moneyFa(r.totalAmount) },
      { key: "allocatedAmount", title: "تخصیص", render: (r) => moneyFa(r.allocatedAmount) },
      { key: "remainingAmount", title: "مانده", render: (r) => moneyFa(r.remainingAmount) },
      { key: "editableRemainingAmount", title: "قابل‌ویرایش", render: (r) => moneyFa(r.editableRemainingAmount) },
    ],
    []
  );

  async function loadHeader() {
    if (!transactionId) return;
    setLoadingHeader(true);
    try {
      const t = await getTransactionById(transactionId);
      setTx(t);
    } catch {
      toast.error("خطا در دریافت اطلاعات تراکنش");
      setTx(null);
    } finally {
      setLoadingHeader(false);
    }
  }

  async function loadAllocations() {
    if (!transactionId) return;
    setLoading(true);
    try {
      const data = await listAllocationsByTransaction(transactionId);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error("خطا در دریافت تخصیص‌ها");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCandidates() {
    if (!transactionId) return;
    setCandidatesLoading(true);
    try {
      const data = await listDebtCandidatesForTransaction(transactionId);
      setDebtCandidates(Array.isArray(data) ? data : []);
    } catch {
      setDebtCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  }

  useEffect(() => {
    loadHeader();
    loadAllocations();
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  async function handleCreate() {
    const dId = Number(debtId);
    const a = Number(amount);

    if (!Number.isFinite(dId) || dId <= 0) return toast.error("بدهی را انتخاب کنید");
    if (!Number.isFinite(a) || a <= 0) return toast.error("مبلغ نامعتبر است");

    // ✅ debt remaining validation
    const d = debtMap[dId];
    if (d && a > Number(d.remainingAmount || 0)) {
      return toast.error("مبلغ تخصیص نمی‌تواند بیشتر از مانده بدهی باشد");
    }

    // ✅ transaction remaining validation
    if (tx && a > Number(tx.remainingAmount || 0)) {
      return toast.error("مبلغ تخصیص نمی‌تواند بیشتر از مانده تراکنش باشد");
    }

    try {
      await createAllocationFromTransaction(transactionId, {
        debtId: dId,
        coveredAmount: a,
        dsc: dsc?.trim() || null,
      });
      toast.success("تخصیص ثبت شد");
      setDebtId(null);
      setAmount("");
      setDsc("");
      await loadHeader();
      await loadAllocations();
      await loadCandidates();
    } catch {
      toast.error("خطا در ثبت تخصیص");
    }
  }

  function openEdit(row) {
    setEditing(row);

    // ✅ FIX: backend uses debtHeaderId (not debtId)
    setEditDebtId(row.debtHeaderId || null);

    setEditAmount(String(row.coveredAmount ?? ""));
    setEditDsc(row.dsc || "");
    setEditOpen(true);

    (async () => {
      try {
        const data = await listDebtCandidatesForTransaction(transactionId, { allocationId: row.id });
        setEditDebtCandidates(Array.isArray(data) ? data : []);
      } catch {
        setEditDebtCandidates([]);
      }
    })();
  }

  async function handleUpdate() {
    if (!editing) return;

    const dId = Number(editDebtId);
    const a = Number(editAmount);

    if (!Number.isFinite(dId) || dId <= 0) return toast.error("بدهی را انتخاب کنید");
    if (!Number.isFinite(a) || a <= 0) return toast.error("مبلغ نامعتبر است");

    const d = editDebtMap[dId];
    if (d && a > Number(d.editableRemainingAmount || 0)) {
      return toast.error("مبلغ تخصیص بیشتر از مانده قابل ویرایش بدهی است");
    }

    // ✅ transaction remaining validation (client-side)
    // (for edit mode: tx.remainingAmount already includes existing allocations in backend,
    // but we still keep this basic check)
    if (tx && a > Number(tx.amountPaid || 0)) {
      return toast.error("مبلغ تخصیص نامعتبر است");
    }

    try {
      await updateAllocationFromTransaction(transactionId, editing.id, {
        debtId: dId,
        coveredAmount: a,
        dsc: editDsc?.trim() || null,
      });
      toast.success("ویرایش انجام شد");
      setEditOpen(false);
      setEditing(null);
      await loadHeader();
      await loadAllocations();
      await loadCandidates();
    } catch {
      toast.error("خطا در ویرایش");
    }
  }

  async function handleDelete() {
    try {
      await deleteAllocationFromTransaction(transactionId, deleteTarget);
      toast.success("حذف شد");
      setDeleteTarget(null);
      await loadHeader();
      await loadAllocations();
      await loadCandidates();
    } catch {
      toast.error("حذف ممکن نیست");
    }
  }

  const selectedDebt = debtId ? debtMap[Number(debtId)] : null;
  const selectedEditDebt = editDebtId ? editDebtMap[Number(editDebtId)] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-lg">تخصیص‌ها (Transaction #{transactionId})</div>
          <Button variant="secondary" onClick={() => window.history.back()}>
            بازگشت
          </Button>
        </div>

        {loadingHeader ? (
          <div className="text-sm text-zinc-500 mt-2">در حال بارگذاری...</div>
        ) : tx ? (
          <div className="text-sm text-zinc-700 mt-2">
            کد: <b>{tx.code || "-"}</b> | مبلغ: <b>{moneyFa(tx.amountPaid)}</b> | مانده:{" "}
            <b className="text-emerald-600">{moneyFa(tx.remainingAmount)}</b> | ثبت: <b>{dateFa(tx.dateRegistered)}</b>
          </div>
        ) : null}
      </div>

      {/* Create */}
      <div className="rounded-2xl border bg-white p-3">
        <div className="font-semibold mb-2">ثبت تخصیص جدید</div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Lookup field */}
          <div>
            <label className="block text-sm text-zinc-700 mb-1">بدهی</label>
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-zinc-50"
                value={selectedDebt ? debtLabel(selectedDebt) : ""}
                placeholder={candidatesLoading ? "در حال بارگذاری..." : "انتخاب کنید..."}
                readOnly
              />
              <Button variant="secondary" onClick={() => setDebtLookupOpen(true)} disabled={candidatesLoading}>
                انتخاب
              </Button>
              <Button variant="secondary" onClick={() => setDebtId(null)} disabled={!debtId}>
                پاک
              </Button>
            </div>
            <div className="text-xs text-zinc-500 mt-1">تعداد گزینه‌ها: {debtCandidates.length}</div>
          </div>

          <Input label="مبلغ" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={0} />
          <Input label="توضیحات" value={dsc} onChange={(e) => setDsc(e.target.value)} placeholder="اختیاری" />

          <div className="flex items-end">
            <Button onClick={handleCreate}>ثبت</Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border bg-white p-3">
        <div className="font-semibold mb-2">لیست تخصیص‌ها</div>

        {loading ? (
          <div className="text-sm text-zinc-500">در حال بارگذاری...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-zinc-500">تخصیصی ثبت نشده است.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-600">
                <tr className="border-b">
                  <th className="py-2 text-right">بدهی</th>
                  <th className="py-2 text-right">جمع بدهی</th>
                  <th className="py-2 text-right">مانده بدهی</th>
                  <th className="py-2 text-right">مبلغ تخصیص</th>
                  <th className="py-2 text-right">توضیحات</th>
                  <th className="py-2 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  // ✅ FIX: backend returns debtHeaderId
                  const d = debtMap[r.debtHeaderId];

                  return (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 font-semibold">{d?.personTitle || `Debt #${r.debtHeaderId}`}</td>
                      <td className="py-2">{d ? moneyFa(d.totalAmount) : "-"}</td>
                      <td className="py-2">{d ? moneyFa(d.remainingAmount) : "-"}</td>
                      <td className="py-2 font-semibold">{moneyFa(r.coveredAmount)}</td>
                      <td className="py-2">{r.dsc || "-"}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => navigate(`/debts/${r.debtHeaderId}/allocations`)}>
                            مشاهده بدهی
                          </Button>
                          <Button variant="secondary" onClick={() => openEdit(r)}>
                            ویرایش
                          </Button>
                          <Button variant="danger" onClick={() => setDeleteTarget(r.id)}>
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create lookup modal */}
      <LookupTableModal
        open={debtLookupOpen}
        title="انتخاب بدهی"
        rows={debtCandidates}
        columns={debtLookupColumns}
        searchPlaceholder="جستجو بر اساس نام شخص/سازمان..."
        searchKeys={["personTitle", "id"]}
        onSelect={(d) => setDebtId(d.id)}
        onClose={() => setDebtLookupOpen(false)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف تخصیص"
        message="آیا از حذف این تخصیص مطمئن هستید؟"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <Modal
        open={editOpen}
        title={`ویرایش تخصیص #${editing?.id || ""}`}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditOpen(false);
                setEditing(null);
              }}
            >
              انصراف
            </Button>
            <Button onClick={handleUpdate}>ثبت تغییرات</Button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Edit lookup field */}
          <div>
            <label className="block text-sm text-zinc-700 mb-1">بدهی</label>
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-zinc-50"
                value={selectedEditDebt ? debtLabel(selectedEditDebt) : ""}
                placeholder="انتخاب کنید..."
                readOnly
              />
              <Button variant="secondary" onClick={() => setEditDebtLookupOpen(true)}>
                انتخاب
              </Button>
              <Button variant="secondary" onClick={() => setEditDebtId(null)} disabled={!editDebtId}>
                پاک
              </Button>
            </div>
            {selectedEditDebt ? (
              <div className="text-xs text-zinc-600 mt-1">
                مانده: <b>{moneyFa(selectedEditDebt.remainingAmount)}</b> | قابل‌ویرایش:{" "}
                <b>{moneyFa(selectedEditDebt.editableRemainingAmount)}</b>
              </div>
            ) : null}
          </div>

          <Input label="مبلغ تخصیص" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          <Input label="توضیحات" value={editDsc} onChange={(e) => setEditDsc(e.target.value)} placeholder="اختیاری" />
        </div>
      </Modal>

      {/* Edit lookup modal */}
      <LookupTableModal
        open={editDebtLookupOpen}
        title="انتخاب بدهی"
        rows={editDebtCandidates}
        columns={debtLookupColumns}
        searchPlaceholder="جستجو بر اساس نام شخص/سازمان..."
        searchKeys={["personTitle", "id"]}
        onSelect={(d) => setEditDebtId(d.id)}
        onClose={() => setEditDebtLookupOpen(false)}
      />
    </div>
  );
}
