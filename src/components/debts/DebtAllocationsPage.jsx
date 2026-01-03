import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "../common/Button";
import Input from "../common/Input";
import ConfirmDialog from "../common/ConfirmDialog";
import Modal from "../common/Modal";
import LookupTableModal from "../common/LookupTableModal";

import { getDebtView } from "../../api/debtsApi";
import { getPersons } from "../../api/personsApi";
import { getProjects } from "../../api/projectsApi";
import {
  listAllocations,
  createAllocation,
  updateAllocation,
  deleteAllocation,
  listTransactionCandidatesForDebt,
} from "../../api/debtAllocationsApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

function moneyFa(v) {
  return Number(v || 0).toLocaleString("fa-IR");
}

function dateFa(v) {
  if (!v) return "-";
  return String(v).replace("T", " ").substring(0, 16);
}

function normalizePageLike(data) {
  if (Array.isArray(data)) return { content: data, totalPages: 1 };
  if (data?.content) return data;
  return { content: [], totalPages: 0 };
}

function personLabel(p) {
  if (!p) return "-";
  if (p.isLegal) return p.companyName || `#${p.id}`;
  const full = `${p.name || ""} ${p.lastName || ""}`.trim();
  return full || p.companyName || `#${p.id}`;
}

function txLabel(tx) {
  if (!tx) return "-";
  const code = tx.code || `#${tx.id}`;
  const a = moneyFa(tx.amountPaid);
  const r = moneyFa(tx.remainingAmount);
  return `${code} | مبلغ: ${a} | مانده: ${r}`;
}

export default function DebtAllocationsPage() {
  const { debtId } = useParams();
  const navigate = useNavigate();

  const [loadingHeader, setLoadingHeader] = useState(false);
  const [debtView, setDebtView] = useState(null);

  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [personsMap, setPersonsMap] = useState({});
  const [projectsMap, setProjectsMap] = useState({});

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [txCandidates, setTxCandidates] = useState([]);
  const txMap = useMemo(() => {
    const m = {};
    for (const t of txCandidates || []) m[t.id] = t;
    return m;
  }, [txCandidates]);

  // create form
  const [transactionId, setTransactionId] = useState(null);
  const [amount, setAmount] = useState("");
  const [dsc, setDsc] = useState("");

  // lookup modal (create)
  const [txLookupOpen, setTxLookupOpen] = useState(false);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [editTxCandidates, setEditTxCandidates] = useState([]);
  const editTxMap = useMemo(() => {
    const m = {};
    for (const t of editTxCandidates || []) m[t.id] = t;
    return m;
  }, [editTxCandidates]);

  const [editTransactionId, setEditTransactionId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDsc, setEditDsc] = useState("");

  // lookup modal (edit)
  const [editTxLookupOpen, setEditTxLookupOpen] = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  const remainingDebt = useMemo(() => Number(debtView?.remainingAmount || 0), [debtView]);

  const txLookupColumns = useMemo(
    () => [
      { key: "code", title: "کد", render: (r) => <span className="font-semibold">{r.code || `#${r.id}`}</span> },
      { key: "dateRegistered", title: "ثبت", render: (r) => dateFa(r.dateRegistered) },
      { key: "amountPaid", title: "مبلغ", render: (r) => moneyFa(r.amountPaid) },
      { key: "allocatedAmount", title: "تخصیص", render: (r) => moneyFa(r.allocatedAmount) },
      { key: "remainingAmount", title: "مانده", render: (r) => moneyFa(r.remainingAmount) },
      { key: "editableRemainingAmount", title: "قابل‌ویرایش", render: (r) => moneyFa(r.editableRemainingAmount) },
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      setLookupsLoading(true);
      try {
        const personsRes = await getPersons({ page: 0, size: 5000, q: "" });
        const persons = normalizePageLike(personsRes).content || [];
        const pm = {};
        for (const p of persons) pm[p.id] = personLabel(p);
        if (alive) setPersonsMap(pm);
      } catch {
        if (alive) setPersonsMap({});
      }

      try {
        const projectsRes = await getProjects({ page: 0, size: 5000, q: "" });
        const projects = normalizePageLike(projectsRes).content || projectsRes || [];
        const pr = {};
        for (const p of projects) pr[p.id] = p.title || `#${p.id}`;
        if (alive) setProjectsMap(pr);
      } catch {
        if (alive) setProjectsMap({});
      } finally {
        if (alive) setLookupsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function loadHeader() {
    if (!debtId) return;
    setLoadingHeader(true);
    try {
      const v = await getDebtView(debtId);
      setDebtView(v);
    } catch(e) {
      toast.error(getApiErrorMessage(e,"خطا در دریافت اطلاعات بدهی"));
      setDebtView(null);
    } finally {
      setLoadingHeader(false);
    }
  }

  async function loadAllocations() {
    if (!debtId) return;
    setLoading(true);
    try {
      const data = await listAllocations(debtId);
      setRows(Array.isArray(data) ? data : []);
    } catch(e) {
      toast.error(getApiErrorMessage("خطا در دریافت تخصیص‌ها"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCandidates() {
    if (!debtId) return;
    setCandidatesLoading(true);
    try {
      const data = await listTransactionCandidatesForDebt(debtId, {});
      setTxCandidates(Array.isArray(data) ? data : []);
    } catch(e) {
      toast.error(getApiErrorMessage("خطا در دریافت گزینه‌های تراکنش"));
      setTxCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  }

  useEffect(() => {
    loadHeader();
    loadAllocations();
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtId]);

  const selectedTx = transactionId ? txMap[Number(transactionId)] : null;

  async function handleCreate() {
    if (!transactionId) {
      toast.error("لطفاً تراکنش را انتخاب کنید");
      return;
    }
    const v = Number(amount || 0);
    if (!v || v <= 0) {
      toast.error("مبلغ نامعتبر است");
      return;
    }

    try {
      await createAllocation(debtId, {
        transactionId: Number(transactionId),
        coveredAmount: v,
        dsc,
      });
      toast.success("ثبت شد");
      setTransactionId(null);
      setAmount("");
      setDsc("");
      await loadHeader();
      await loadAllocations();
      await loadCandidates();
    } catch (e) {
      toast.error(e?.response?.data?.message || "ثبت ممکن نیست");
    }
  }

  async function openEdit(row) {
    setEditing(row);
    setEditOpen(true);
    setEditTransactionId(row.transactionId);
    setEditAmount(String(row.coveredAmount || ""));
    setEditDsc(row.dsc || "");

    try {
      const data = await listTransactionCandidatesForDebt(debtId, { allocationId: row.id });
      setEditTxCandidates(Array.isArray(data) ? data : []);
    } catch {
      setEditTxCandidates([]);
    }
  }

  const selectedEditTx = editTransactionId ? editTxMap[Number(editTransactionId)] : null;

  async function handleUpdate() {
    if (!editing?.id) return;

    if (!editTransactionId) {
      toast.error("لطفاً تراکنش را انتخاب کنید");
      return;
    }
    const v = Number(editAmount || 0);
    if (!v || v <= 0) {
      toast.error("مبلغ نامعتبر است");
      return;
    }

    try {
      await updateAllocation(debtId, editing.id, {
        transactionId: Number(editTransactionId),
        coveredAmount: v,
        dsc: editDsc,
      });
      toast.success("ویرایش شد");
      setEditOpen(false);
      setEditing(null);
      await loadHeader();
      await loadAllocations();
      await loadCandidates();
    } catch (e) {
      toast.error(e?.response?.data?.message || "خطا در ویرایش");
    }
  }

  async function handleDelete() {
    try {
      await deleteAllocation(debtId, deleteTarget);
      toast.success("حذف شد");
      setDeleteTarget(null);
      await loadHeader();
      await loadAllocations();
      await loadCandidates();
    } catch(e) {
      toast.error(getApiErrorMessage("حذف ممکن نیست"));
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-lg">تخصیص‌ها (Debt #{debtId})</div>
          <Button variant="secondary" onClick={() => window.history.back()}>
            بازگشت
          </Button>
        </div>

        {loadingHeader || lookupsLoading ? (
          <div className="text-sm text-zinc-500 mt-2">در حال بارگذاری...</div>
        ) : debtView?.header ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 rounded-xl bg-zinc-50 p-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-zinc-600">پروژه:</span>{" "}
                <b>
                  {projectsMap[debtView.header.projectId] ||
                    (debtView.header.projectId ? `#${debtView.header.projectId}` : "-")}
                </b>
              </div>
              <div>
                <span className="text-zinc-600">شخص/سازمان:</span>{" "}
                <b>
                  {personsMap[debtView.header.personId] ||
                    (debtView.header.personId ? `#${debtView.header.personId}` : "-")}
                </b>
              </div>
              <div>
                <span className="text-zinc-600">سررسید:</span> <b>{debtView.header.dateDue || "-"}</b>
              </div>
              <div>
                <span className="text-zinc-600">ثبت:</span> <b>{dateFa(debtView.header.dateRegistered)}</b>
              </div>

              <div className="md:col-span-2">
                <span className="text-zinc-600">توضیحات:</span> <b>{debtView.header.dsc || "-"}</b>
              </div>

              <div className="md:col-span-2 border-t pt-2">
                <span className="text-zinc-600">جمع:</span> <b>{moneyFa(debtView.totalAmount)}</b>{" "}
                <span className="text-zinc-400">|</span>{" "}
                <span className="text-zinc-600">تخصیص:</span> <b>{moneyFa(debtView.coveredAmount)}</b>{" "}
                <span className="text-zinc-400">|</span>{" "}
                <span className="text-zinc-600">مانده:</span>{" "}
                <b className="text-emerald-700">{moneyFa(debtView.remainingAmount)}</b>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Create */}
      <div className="rounded-2xl border bg-white p-3">
        <div className="font-semibold mb-2">ثبت تخصیص جدید</div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm text-zinc-700 mb-1">تراکنش</label>
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-zinc-50"
                value={selectedTx ? txLabel(selectedTx) : ""}
                placeholder={candidatesLoading ? "در حال بارگذاری..." : "انتخاب کنید..."}
                readOnly
              />
              <Button variant="secondary" onClick={() => setTxLookupOpen(true)} disabled={candidatesLoading}>
                انتخاب
              </Button>
              <Button variant="secondary" onClick={() => setTransactionId(null)} disabled={!transactionId}>
                پاک
              </Button>
            </div>
            <div className="text-xs text-zinc-500 mt-1">تعداد گزینه‌ها: {txCandidates.length}</div>
          </div>

          <Input label="مبلغ" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={0} />
          <Input label="توضیحات" value={dsc} onChange={(e) => setDsc(e.target.value)} placeholder="اختیاری" />

          <div className="flex items-end">
            <Button onClick={handleCreate}>ثبت</Button>
          </div>
        </div>

        <div className="text-xs text-zinc-500 mt-2">مانده قابل تخصیص بدهی: {moneyFa(remainingDebt)}</div>
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
                  <th className="py-2 text-right">تراکنش</th>
                  <th className="py-2 text-right">تاریخ</th>
                  <th className="py-2 text-right">مبلغ تراکنش</th>
                  <th className="py-2 text-right">مبلغ تخصیص</th>
                  <th className="py-2 text-right">توضیحات</th>
                  <th className="py-2 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tx = txMap[r.transactionId];
                  return (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 font-semibold">{tx?.code || `#${r.transactionId}`}</td>
                      <td className="py-2">{dateFa(tx?.dateRegistered)}</td>
                      <td className="py-2">{tx ? moneyFa(tx.amountPaid) : "-"}</td>
                      <td className="py-2 font-semibold">{moneyFa(r.coveredAmount)}</td>
                      <td className="py-2">{r.dsc || "-"}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => navigate(`/transactions/${r.transactionId}/allocations`)}>
                            مشاهده تراکنش
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

      <LookupTableModal
        open={txLookupOpen}
        title="انتخاب تراکنش"
        rows={txCandidates}
        columns={txLookupColumns}
        searchPlaceholder="جستجو بر اساس کد..."
        searchKeys={["code"]}
        onSelect={(tx) => setTransactionId(tx.id)}
        onClose={() => setTxLookupOpen(false)}
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
          <div>
            <label className="block text-sm text-zinc-700 mb-1">تراکنش</label>
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-zinc-50"
                value={selectedEditTx ? txLabel(selectedEditTx) : ""}
                placeholder="انتخاب کنید..."
                readOnly
              />
              <Button variant="secondary" onClick={() => setEditTxLookupOpen(true)}>
                انتخاب
              </Button>
              <Button variant="secondary" onClick={() => setEditTransactionId(null)} disabled={!editTransactionId}>
                پاک
              </Button>
            </div>
            {selectedEditTx ? (
              <div className="text-xs text-zinc-600 mt-1">
                مانده: <b>{moneyFa(selectedEditTx.remainingAmount)}</b> | قابل‌ویرایش:{" "}
                <b>{moneyFa(selectedEditTx.editableRemainingAmount)}</b>
              </div>
            ) : null}
          </div>

          <Input label="مبلغ تخصیص" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          <Input label="توضیحات" value={editDsc} onChange={(e) => setEditDsc(e.target.value)} placeholder="اختیاری" />
        </div>
      </Modal>

      <LookupTableModal
        open={editTxLookupOpen}
        title="انتخاب تراکنش"
        rows={editTxCandidates}
        columns={txLookupColumns}
        searchPlaceholder="جستجو بر اساس کد..."
        searchKeys={["code"]}
        onSelect={(tx) => setEditTransactionId(tx.id)}
        onClose={() => setEditTxLookupOpen(false)}
      />
    </div>
  );
}
