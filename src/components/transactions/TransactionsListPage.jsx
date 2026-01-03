import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../common/Button";
import DataTable from "../table/DataTable";
import Pagination from "../table/Pagination";
import ConfirmDialog from "../common/ConfirmDialog";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

import {
  deleteTransaction,
  getTransactionById,
  getTransactions,
} from "../../api/transactionsApi";
import QuickAddTransactionModal from "./QuickAddTransactionModal";
import EditTransactionModal from "./EditTransactionModal";

import { getPersons } from "../../api/personsApi";
import { getProjects } from "../../api/projectsApi";

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

function moneyFa(v) {
  return Number(v || 0).toLocaleString("fa-IR");
}

function normalizeText(v) {
  return String(v ?? "").trim().toLowerCase();
}

function toDateSortable(v) {
  const t = Date.parse(v || "");
  return Number.isFinite(t) ? t : 0;
}

/** ✅ IMPORTANT: move these OUTSIDE so input won't lose focus */
const HeaderFilterInput = React.memo(function HeaderFilterInput({
  value,
  onChange,
  placeholder = "فیلتر...",
}) {
  return (
    <input
      className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs"
      placeholder={placeholder}
      value={value || ""}
      onChange={onChange}
    />
  );
});

const SortableHeader = React.memo(function SortableHeader({
  title,
  icon,
  onClick,
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 font-semibold"
      onClick={onClick}
      title="مرتب‌سازی"
    >
      <span>{title}</span>
      <span className="text-xs text-zinc-500">{icon}</span>
    </button>
  );
});

export default function TransactionsListPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const [size] = useState(20);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ content: [], totalPages: 0 });

  const [deleteId, setDeleteId] = useState(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // per-column filters
  const [cf, setCf] = useState({
    id: "",
    code: "",
    project: "",
    from: "",
    to: "",
    dateDue: "",
    amountPaid: "",
    allocatedAmount: "",
    remainingAmount: "",
    paymentType: "",
    transactionType: "",
    dateRegistered: "",
    dsc: "",
  });

  // sorting
  const [sort, setSort] = useState({ key: null, dir: null });

  // lookup caches
  const [personsMap, setPersonsMap] = useState({});
  const [projectsMap, setProjectsMap] = useState({});

  const loadLookups = useCallback(async () => {
    try {
      const personsRes = await getPersons({ page: 0, size: 5000, q: "" });
      const persons = normalizePageLike(personsRes).content || [];
      const pm = {};
      for (const p of persons) pm[p.id] = personLabel(p);
      setPersonsMap(pm);
    } catch {}

    try {
      const projectsRes = await getProjects({ page: 0, size: 5000, q: "" });
      const projects =
        normalizePageLike(projectsRes).content || projectsRes || [];
      const pr = {};
      for (const p of projects) pr[p.id] = p.title || `#${p.id}`;
      setProjectsMap(pr);
    } catch {}
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const load = useCallback(
    async ({ nextPage = page } = {}) => {
      setLoading(true);
      try {
        const res = await getTransactions({ q: "", page: nextPage, size });
        setData(normalizePageLike(res));
      } catch (e) {
        toast.error(getApiErrorMessage(e, "خطا در دریافت لیست تراکنش‌ها"));
        setData({ content: [], totalPages: 0 });
      } finally {
        setLoading(false);
      }
    },
    [page, size]
  );

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!alive) return;
      await load();
    }, 150);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [page, load]);

  const rowValue = useCallback(
    (r, key) => {
      if (!r) return "";

      if (key === "id") return r.id ?? "";
      if (key === "code") return r.code ?? "";

      if (key === "project") {
        const id = r.projectId || r.project?.id;
        return id ? projectsMap[id] || `#${id}` : "-";
      }

      if (key === "from") {
        const id = r.fromPersonId || r.fromPerson?.id;
        return id ? personsMap[id] || `#${id}` : "-";
      }

      if (key === "to") {
        const id = r.toPersonId || r.toPerson?.id;
        return id ? personsMap[id] || `#${id}` : "-";
      }

      if (key === "dateDue") return r.dateDue || "-";

      if (key === "amountPaid") return r.amountPaid ?? "";
      if (key === "allocatedAmount") return r.allocatedAmount ?? "";
      if (key === "remainingAmount") return r.remainingAmount ?? "";

      if (key === "paymentType") return paymentTypeLabel(r.paymentType);
      if (key === "transactionType")
        return transactionTypeLabel(r.transactionType);

      if (key === "dateRegistered") {
        return r.dateRegistered
          ? r.dateRegistered.replace("T", " ").substring(0, 16)
          : "-";
      }

      if (key === "dsc") return r.dsc || "-";

      return "";
    },
    [personsMap, projectsMap]
  );

  const filteredSortedRows = useMemo(() => {
    const rows = data.content || [];

    const filtered = rows.filter((r) => {
      for (const k of Object.keys(cf)) {
        const needle = normalizeText(cf[k]);
        if (!needle) continue;

        const val = rowValue(r, k);

        if (
          k === "amountPaid" ||
          k === "allocatedAmount" ||
          k === "remainingAmount" ||
          k === "id"
        ) {
          const v = normalizeText(String(val ?? ""));
          if (!v.includes(needle)) return false;
          continue;
        }

        const hay = normalizeText(val);
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    if (!sort.key || !sort.dir) return filtered;

    const dirMul = sort.dir === "asc" ? 1 : -1;
    const key = sort.key;

    return [...filtered].sort((a, b) => {
      if (key === "id") return dirMul * (Number(a.id || 0) - Number(b.id || 0));
      if (key === "amountPaid")
        return dirMul * (Number(a.amountPaid || 0) - Number(b.amountPaid || 0));
      if (key === "allocatedAmount")
        return (
          dirMul *
          (Number(a.allocatedAmount || 0) - Number(b.allocatedAmount || 0))
        );
      if (key === "remainingAmount")
        return (
          dirMul *
          (Number(a.remainingAmount || 0) - Number(b.remainingAmount || 0))
        );

      if (key === "dateDue")
        return dirMul * (toDateSortable(a.dateDue) - toDateSortable(b.dateDue));
      if (key === "dateRegistered")
        return (
          dirMul *
          (toDateSortable(a.dateRegistered) - toDateSortable(b.dateRegistered))
        );

      const va = normalizeText(rowValue(a, key));
      const vb = normalizeText(rowValue(b, key));
      if (va < vb) return -1 * dirMul;
      if (va > vb) return 1 * dirMul;
      return 0;
    });
  }, [data.content, cf, sort, rowValue]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: null, dir: null };
    });
  }

  function sortIcon(key) {
    if (sort.key !== key || !sort.dir) return "⇅";
    return sort.dir === "asc" ? "↑" : "↓";
  }

  const columns = useMemo(
    () => [
      // { key: "id", title: "ID", render: (r) => r.id },
      { key: "code", title: "کد", render: (r) => <b>{r.code || "-"}</b> },
      { key: "project", title: "پروژه", render: (r) => rowValue(r, "project") },
      { key: "from", title: "از", render: (r) => rowValue(r, "from") },
      { key: "to", title: "به", render: (r) => rowValue(r, "to") },
      { key: "dateDue", title: "سررسید", render: (r) => rowValue(r, "dateDue") },
      {
        key: "amountPaid",
        title: "مبلغ",
        render: (r) => (r.amountPaid != null ? moneyFa(r.amountPaid) : "-"),
      },
      {
        key: "allocatedAmount",
        title: "تخصیص",
        render: (r) => (r.allocatedAmount != null ? moneyFa(r.allocatedAmount) : "-"),
      },
      {
        key: "remainingAmount",
        title: "مانده",
        render: (r) => (r.remainingAmount != null ? moneyFa(r.remainingAmount) : "-"),
      },
      {
        key: "paymentType",
        title: "نوع پرداخت",
        render: (r) => (
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">
            {paymentTypeLabel(r.paymentType)}
          </span>
        ),
      },
      {
        key: "transactionType",
        title: "نوع تراکنش",
        render: (r) => (
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">
            {transactionTypeLabel(r.transactionType)}
          </span>
        ),
      },
      //{ key: "dateRegistered", title: "ثبت", render: (r) => rowValue(r, "dateRegistered") },
      { key: "dsc", title: "توضیحات", render: (r) => r.dsc || "-" },
      {
        key: "actions",
        title: "عملیات",
        render: (r) => (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(`/transactions/${r.id}/allocations`)}>
              تخصیص‌ها
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/transactions/${r.id}/documents`)}>
              پیوست‌ها
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  setEditLoading(true);
                  setEditing(null);
                  setEditOpen(true);
                  const fresh = await getTransactionById(r.id);
                  setEditing(fresh);
                } catch (e) {
                  toast.error(getApiErrorMessage(e, "خطا در دریافت اطلاعات تراکنش"));
                  setEditOpen(false);
                } finally {
                  setEditLoading(false);
                }
              }}
            >
              ویرایش
            </Button>
            <Button variant="danger" onClick={() => setDeleteId(r.id)}>
              حذف
            </Button>
          </div>
        ),
      },
    ],
    [navigate, rowValue]
  );

  async function handleDelete() {
    try {
      await deleteTransaction(deleteId);
      toast.success("حذف شد");
      setDeleteId(null);

      const isLastRowOnPage = (data?.content || []).length <= 1;
      const nextPage = isLastRowOnPage && page > 0 ? page - 1 : page;

      if (nextPage !== page) setPage(nextPage);
      await load({ nextPage });
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در حذف"));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold">تراکنش‌ها (دریافت/پرداخت)</div>
        <Button onClick={() => setQuickAddOpen(true)}>+ جدید</Button>
      </div>

      <div className="mb-3 rounded-2xl border bg-white p-3 overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-600">
            <tr className="border-b">
              {/* <th className="py-2 text-right">
                <SortableHeader title="ID" icon={sortIcon("id")} onClick={() => toggleSort("id")} />
              </th> */}
              <th className="py-2 text-right">
                <SortableHeader title="کد" icon={sortIcon("code")} onClick={() => toggleSort("code")} />
              </th>
              <th className="py-2 text-right">
                <SortableHeader title="پروژه" icon={sortIcon("project")} onClick={() => toggleSort("project")} />
              </th>
              <th className="py-2 text-right">
                <SortableHeader title="از" icon={sortIcon("from")} onClick={() => toggleSort("from")} />
              </th>
              <th className="py-2 text-right">
                <SortableHeader title="به" icon={sortIcon("to")} onClick={() => toggleSort("to")} />
              </th>
              <th className="py-2 text-right">
                <SortableHeader title="سررسید" icon={sortIcon("dateDue")} onClick={() => toggleSort("dateDue")} />
              </th>
              <th className="py-2 text-right">
                <SortableHeader title="مبلغ" icon={sortIcon("amountPaid")} onClick={() => toggleSort("amountPaid")} />
              </th>
              <th className="py-2 text-right">
                <SortableHeader title="تخصیص" icon={sortIcon("allocatedAmount")} onClick={() => toggleSort("allocatedAmount")} />
              </th>
              <th className="py-2 text-right">
                <SortableHeader title="مانده" icon={sortIcon("remainingAmount")} onClick={() => toggleSort("remainingAmount")} />
              </th>
              <th className="py-2 text-right">
                <SortableHeader title="نوع پرداخت" icon={sortIcon("paymentType")} onClick={() => toggleSort("paymentType")} />
              </th>
              <th className="py-2 text-right">
                <SortableHeader title="نوع تراکنش" icon={sortIcon("transactionType")} onClick={() => toggleSort("transactionType")} />
              </th>
              {/* <th className="py-2 text-right">
                <SortableHeader title="ثبت" icon={sortIcon("dateRegistered")} onClick={() => toggleSort("dateRegistered")} />
              </th> */}
              <th className="py-2 text-right">
                <SortableHeader title="توضیحات" icon={sortIcon("dsc")} onClick={() => toggleSort("dsc")} />
              </th>
              <th className="py-2 text-right">عملیات</th>
            </tr>

            <tr className="border-b bg-zinc-50">
              {/* <th className="py-2">
                <HeaderFilterInput value={cf.id} onChange={(e) => setCf((p) => ({ ...p, id: e.target.value }))} />
              </th> */}
              <th className="py-2">
                <HeaderFilterInput value={cf.code} onChange={(e) => setCf((p) => ({ ...p, code: e.target.value }))} />
              </th>
              <th className="py-2">
                <HeaderFilterInput value={cf.project} onChange={(e) => setCf((p) => ({ ...p, project: e.target.value }))} />
              </th>
              <th className="py-2">
                <HeaderFilterInput value={cf.from} onChange={(e) => setCf((p) => ({ ...p, from: e.target.value }))} />
              </th>
              <th className="py-2">
                <HeaderFilterInput value={cf.to} onChange={(e) => setCf((p) => ({ ...p, to: e.target.value }))} />
              </th>
              <th className="py-2">
                <HeaderFilterInput value={cf.dateDue} onChange={(e) => setCf((p) => ({ ...p, dateDue: e.target.value }))} />
              </th>
              <th className="py-2">
                <HeaderFilterInput value={cf.amountPaid} onChange={(e) => setCf((p) => ({ ...p, amountPaid: e.target.value }))} />
              </th>
              <th className="py-2">
                <HeaderFilterInput value={cf.allocatedAmount} onChange={(e) => setCf((p) => ({ ...p, allocatedAmount: e.target.value }))} />
              </th>
              <th className="py-2">
                <HeaderFilterInput value={cf.remainingAmount} onChange={(e) => setCf((p) => ({ ...p, remainingAmount: e.target.value }))} />
              </th>
              <th className="py-2">
                <HeaderFilterInput value={cf.paymentType} onChange={(e) => setCf((p) => ({ ...p, paymentType: e.target.value }))} />
              </th>
              <th className="py-2">
                <HeaderFilterInput value={cf.transactionType} onChange={(e) => setCf((p) => ({ ...p, transactionType: e.target.value }))} />
              </th>
              {/* <th className="py-2">
                <HeaderFilterInput value={cf.dateRegistered} onChange={(e) => setCf((p) => ({ ...p, dateRegistered: e.target.value }))} />
              </th> */}
              <th className="py-2">
                <HeaderFilterInput value={cf.dsc} onChange={(e) => setCf((p) => ({ ...p, dsc: e.target.value }))} />
              </th>
              <th className="py-2">
                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs hover:bg-white"
                  onClick={() => {
                    setCf({
                      id: "",
                      code: "",
                      project: "",
                      from: "",
                      to: "",
                      dateDue: "",
                      amountPaid: "",
                      allocatedAmount: "",
                      remainingAmount: "",
                      paymentType: "",
                      transactionType: "",
                      dateRegistered: "",
                      dsc: "",
                    });
                    setSort({ key: null, dir: null });
                  }}
                >
                  پاک‌کردن
                </button>
              </th>
            </tr>
          </thead>
        </table>

        <div className="mt-3">
          <DataTable columns={columns} rows={filteredSortedRows} loading={loading} />
        </div>
      </div>

      <Pagination page={page} totalPages={data.totalPages || 0} onPage={setPage} />

      <ConfirmDialog
        open={deleteId !== null}
        title="حذف تراکنش"
        message="آیا از حذف این مورد مطمئن هستید؟"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          await handleDelete();
        }}
      />

      <QuickAddTransactionModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async () => {
          await loadLookups();
          setPage(0);
          await load({ nextPage: 0 });
        }}
      />

      <EditTransactionModal
        key={editing?.id || (editOpen ? "loading" : "closed")}
        open={editOpen}
        transaction={editing}
        loading={editLoading}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
          setEditLoading(false);
        }}
        onUpdated={async () => {
          await loadLookups();
          await load();
        }}
      />
    </>
  );
}
