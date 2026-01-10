import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "../common/Button";
import Input from "../common/Input";
import ConfirmDialog from "../common/ConfirmDialog";
import Modal from "../common/Modal";
import LookupTableModal from "../common/LookupTableModal";

import { getTransactionById } from "../../api/transactionsApi";
import { getPersons } from "../../api/personsApi";
import { getProjects } from "../../api/projectsApi";
import {
  listAllocationsByTransaction,
  createAllocationFromTransaction,
  updateAllocationFromTransaction,
  deleteAllocationFromTransaction,
  listDebtCandidatesForTransaction,
} from "../../api/transactionAllocationsApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

function openDebtInNewTab(debtId) {
  if (!debtId) return;

  const params = new URLSearchParams();
  params.set("hf_debtId", String(debtId));
  params.set("sid", String(debtId));
  params.set("pi", "0");

  const url = `/debts?${params.toString()}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

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

function paymentTypeLabel(code) {
  if (code === "CSH") return "نقد";
  if (code === "CHK") return "چک";
  if (code === "OTH") return "سایر";
  return code || "-";
}

function transactionTypeLabel(code) {
  if (code === "EXP") return "هزینه";
  if (code === "TRN") return "تراکنش";
  if (code === "OTH") return "سایر";
  return code || "-";
}

function debtLabel(d) {
  if (!d) return "-";
  const title = d.personTitle || `#${d.id}`;
  return `${title} | جمع: ${moneyFa(d.totalAmount)} | مانده: ${moneyFa(
    d.remainingAmount
  )}`;
}

export default function TransactionAllocationsPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();

  const [loadingHeader, setLoadingHeader] = useState(false);
  const [tx, setTx] = useState(null);

  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [personsMap, setPersonsMap] = useState({});
  const [projectsMap, setProjectsMap] = useState({});

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
      {
        key: "personTitle",
        title: "شخص/سازمان",
        render: (r) => (
          <span className="font-semibold">{r.personTitle || "-"}</span>
        ),
      },

      // ✅ CHANGED: Registered Date -> Due Date
      {
        key: "dateDue",
        title: "سررسید",
        render: (r) => {
          const v = r.dateDue ?? r.dueDate ?? r.debtDateDue ?? r.headerDateDue;
          // اگر تاریخ فقط yyyy-mm-dd بود هم درست نمایش می‌ده
          return v ? String(v).substring(0, 10) : "-";
        },
      },

      {
        key: "totalAmount",
        title: "جمع",
        render: (r) => moneyFa(r.totalAmount),
      },
      {
        key: "allocatedAmount",
        title: "تخصیص",
        render: (r) => moneyFa(r.allocatedAmount),
      },
      {
        key: "remainingAmount",
        title: "مانده",
        render: (r) => moneyFa(r.remainingAmount),
      },
      {
        key: "editableRemainingAmount",
        title: "قابل‌ویرایش",
        render: (r) => moneyFa(r.editableRemainingAmount),
      },

      // ✅ ADDED: Description
      {
        key: "dsc",
        title: "توضیحات",
        render: (r) => r.dsc ?? r.description ?? "-",
      },
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
        const projects =
          normalizePageLike(projectsRes).content || projectsRes || [];
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
    if (!transactionId) return;
    setLoadingHeader(true);
    try {
      const t = await getTransactionById(transactionId);
      setTx(t);
    } catch (e) {
      toast.error(e, "خطا در دریافت اطلاعات تراکنش");
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
    } catch (e) {
      toast.error(e, "خطا در دریافت تخصیص‌ها");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCandidates() {
    if (!transactionId) return;
    setCandidatesLoading(true);
    try {
      const data = await listDebtCandidatesForTransaction(transactionId, {});
      setDebtCandidates(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e, "خطا در دریافت گزینه‌های بدهی");
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

  const selectedDebt = debtId ? debtMap[Number(debtId)] : null;
  const selectedEditDebt = editDebtId ? editDebtMap[Number(editDebtId)] : null;

  async function handleCreate() {
    if (!debtId) {
      toast.error("لطفاً بدهی را انتخاب کنید");
      return;
    }
    const v = Number(amount || 0);
    if (!v || v <= 0) {
      toast.error("مبلغ نامعتبر است");
      return;
    }

    try {
      await createAllocationFromTransaction(transactionId, {
        debtId: Number(debtId),
        coveredAmount: v,
        dsc,
      });
      toast.success("ثبت شد");
      setDebtId(null);
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
    setEditDebtId(row.debtId ?? row.debtHeaderId);
    setEditAmount(String(row.coveredAmount || ""));
    setEditDsc(row.dsc || "");

    try {
      const data = await listDebtCandidatesForTransaction(transactionId, {
        allocationId: row.id,
      });
      setEditDebtCandidates(Array.isArray(data) ? data : []);
    } catch {
      setEditDebtCandidates([]);
    }
  }

  async function handleUpdate() {
    if (!editing?.id) return;

    if (!editDebtId) {
      toast.error("لطفاً بدهی را انتخاب کنید");
      return;
    }
    const v = Number(editAmount || 0);
    if (!v || v <= 0) {
      toast.error("مبلغ نامعتبر است");
      return;
    }

    try {
      await updateAllocationFromTransaction(transactionId, editing.id, {
        debtId: Number(editDebtId),
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
      await deleteAllocationFromTransaction(transactionId, deleteTarget);
      toast.success("حذف شد");
      setDeleteTarget(null);
      await loadHeader();
      await loadAllocations();
      await loadCandidates();
    } catch (e) {
      toast.error(e, "حذف ممکن نیست");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-lg">
            تخصیص‌ها (Transaction #{transactionId})
          </div>
          <Button variant="secondary" onClick={() => window.history.back()}>
            بازگشت
          </Button>
        </div>

        {loadingHeader || lookupsLoading ? (
          <div className="text-sm text-zinc-500 mt-2">در حال بارگذاری...</div>
        ) : tx ? (
          <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-zinc-50 p-3 text-sm md:grid-cols-2">
            <div>
              <span className="text-zinc-600">کد:</span> <b>{tx.code || "-"}</b>
            </div>
            <div>
              <span className="text-zinc-600">پروژه:</span>{" "}
              <b>
                {projectsMap[tx.projectId] ||
                  (tx.projectId ? `#${tx.projectId}` : "-")}
              </b>
            </div>

            <div>
              <span className="text-zinc-600">از:</span>{" "}
              <b>
                {personsMap[tx.fromPersonId] ||
                  (tx.fromPersonId ? `#${tx.fromPersonId}` : "-")}
              </b>
            </div>
            <div>
              <span className="text-zinc-600">به:</span>{" "}
              <b>
                {personsMap[tx.toPersonId] ||
                  (tx.toPersonId ? `#${tx.toPersonId}` : "-")}
              </b>
            </div>

            <div>
              <span className="text-zinc-600">سررسید:</span>{" "}
              <b>{tx.dateDue || "-"}</b>
            </div>
            <div>
              <span className="text-zinc-600">ثبت:</span>{" "}
              <b>{dateFa(tx.dateRegistered)}</b>
            </div>

            <div>
              <span className="text-zinc-600">نوع پرداخت:</span>{" "}
              <b>{paymentTypeLabel(tx.paymentType)}</b>
            </div>
            <div>
              <span className="text-zinc-600">نوع تراکنش:</span>{" "}
              <b>{transactionTypeLabel(tx.transactionType)}</b>
            </div>

            <div className="md:col-span-2">
              <span className="text-zinc-600">توضیحات:</span>{" "}
              <b>{tx.dsc || "-"}</b>
            </div>

            <div className="md:col-span-2 border-t pt-2">
              <span className="text-zinc-600">مبلغ:</span>{" "}
              <b>{moneyFa(tx.amountPaid)}</b>{" "}
              <span className="text-zinc-400">|</span>{" "}
              <span className="text-zinc-600">تخصیص:</span>{" "}
              <b>{moneyFa(tx.allocatedAmount)}</b>{" "}
              <span className="text-zinc-400">|</span>{" "}
              <span className="text-zinc-600">مانده:</span>{" "}
              <b className="text-emerald-700">{moneyFa(tx.remainingAmount)}</b>
            </div>
          </div>
        ) : null}
      </div>

      {/* Create */}
      <div className="rounded-2xl border bg-white p-3">
        <div className="font-semibold mb-2">ثبت تخصیص جدید</div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm text-zinc-700 mb-1">بدهی</label>
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-zinc-50"
                value={selectedDebt ? debtLabel(selectedDebt) : ""}
                placeholder={
                  candidatesLoading ? "در حال بارگذاری..." : "انتخاب کنید..."
                }
                readOnly
              />
              <Button
                variant="secondary"
                onClick={() => setDebtLookupOpen(true)}
                disabled={candidatesLoading}
              >
                انتخاب
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDebtId(null)}
                disabled={!debtId}
              >
                پاک
              </Button>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              تعداد گزینه‌ها: {debtCandidates.length}
            </div>
          </div>

          <Input
            label="مبلغ"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
          />
          <Input
            label="توضیحات"
            value={dsc}
            onChange={(e) => setDsc(e.target.value)}
            placeholder="اختیاری"
          />

          <div className="flex items-end">
            <Button onClick={handleCreate}>ثبت</Button>
          </div>
        </div>

        <div className="text-xs text-zinc-500 mt-2">
          مانده قابل تخصیص تراکنش: {moneyFa(tx?.remainingAmount)}
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
                  <th className="py-2 text-right">مبلغ تخصیص</th>
                  <th className="py-2 text-right">توضیحات</th>
                  <th className="py-2 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = debtMap[r.debtId ?? r.debtHeaderId];
                  return (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 font-semibold">
                        {d?.personTitle || `#${r.debtId ?? r.debtHeaderId}`}
                      </td>
                      <td className="py-2 font-semibold">
                        {moneyFa(r.coveredAmount)}
                      </td>
                      <td className="py-2">{r.dsc || "-"}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => openDebtInNewTab(r.debtHeaderId)}
                            title="مشاهده بدهی در لیست بدهی‌ها"
                          >
                            مشاهده بدهی
                          </Button>

                          <Button
                            variant="secondary"
                            onClick={() => openEdit(r)}
                          >
                            ویرایش
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => setDeleteTarget(r.id)}
                          >
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
        open={debtLookupOpen}
        title="انتخاب بدهی"
        rows={debtCandidates}
        columns={debtLookupColumns}
        searchPlaceholder="جستجو..."
        // ✅ include description too
        searchKeys={["personTitle", "dsc", "description"]}
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
          <div>
            <label className="block text-sm text-zinc-700 mb-1">بدهی</label>
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm bg-zinc-50"
                value={selectedEditDebt ? debtLabel(selectedEditDebt) : ""}
                placeholder="انتخاب کنید..."
                readOnly
              />
              <Button
                variant="secondary"
                onClick={() => setEditDebtLookupOpen(true)}
              >
                انتخاب
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditDebtId(null)}
                disabled={!editDebtId}
              >
                پاک
              </Button>
            </div>
          </div>

          <Input
            label="مبلغ تخصیص"
            type="number"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
          />
          <Input
            label="توضیحات"
            value={editDsc}
            onChange={(e) => setEditDsc(e.target.value)}
            placeholder="اختیاری"
          />
        </div>
      </Modal>

      <LookupTableModal
        open={editDebtLookupOpen}
        title="انتخاب بدهی"
        rows={editDebtCandidates}
        columns={debtLookupColumns}
        searchPlaceholder="جستجو..."
        // ✅ include description too
        searchKeys={["personTitle", "dsc", "description"]}
        onSelect={(d) => setEditDebtId(d.id)}
        onClose={() => setEditDebtLookupOpen(false)}
      />
    </div>
  );
}
