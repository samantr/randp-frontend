import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../common/Button";
import FiltersBar from "../table/FiltersBar";
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

export default function TransactionsListPage() {
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size] = useState(20);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ content: [], totalPages: 0 });

  const [deleteId, setDeleteId] = useState(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // lookup caches: id -> label
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
    async ({ nextQ = q, nextPage = page } = {}) => {
      setLoading(true);
      try {
        const res = await getTransactions({ q: nextQ, page: nextPage, size });
        setData(normalizePageLike(res));
      } catch {
        toast.error(getApiErrorMessage(e, "خطا در دریافت لیست تراکنش‌ها"));
        setData({ content: [], totalPages: 0 });
      } finally {
        setLoading(false);
      }
    },
    [q, page, size]
  );

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!alive) return;
      await load();
    }, 250);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, page, load]);

  const columns = useMemo(
    () => [
      { key: "id", title: "ID", render: (r) => r.id },

      {
        key: "code",
        title: "کد",
        render: (r) => <span className="font-semibold">{r.code || "-"}</span>,
      },

      {
        key: "project",
        title: "پروژه",
        render: (r) => {
          const id = r.projectId || r.project?.id;
          if (!id) return "-";
          return projectsMap[id] || `#${id}`;
        },
      },

      {
        key: "from",
        title: "از",
        render: (r) => {
          const id = r.fromPersonId || r.fromPerson?.id;
          if (!id) return "-";
          return personsMap[id] || `#${id}`;
        },
      },

      {
        key: "to",
        title: "به",
        render: (r) => {
          const id = r.toPersonId || r.toPerson?.id;
          if (!id) return "-";
          return personsMap[id] || `#${id}`;
        },
      },

      { key: "dateDue", title: "سررسید", render: (r) => r.dateDue || "-" },

      {
        key: "amountPaid",
        title: "مبلغ",
        render: (r) => (r.amountPaid != null ? moneyFa(r.amountPaid) : "-"),
      },

      // ✅ NEW
      {
        key: "allocatedAmount",
        title: "تخصیص",
        render: (r) =>
          r.allocatedAmount != null ? moneyFa(r.allocatedAmount) : "-",
      },

      // ✅ NEW
      {
        key: "remainingAmount",
        title: "مانده",
        render: (r) =>
          r.remainingAmount != null ? moneyFa(r.remainingAmount) : "-",
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

      {
        key: "dateRegistered",
        title: "ثبت",
        render: (r) =>
          r.dateRegistered
            ? r.dateRegistered.replace("T", " ").substring(0, 16)
            : "-",
      },

      { key: "dsc", title: "توضیحات", render: (r) => r.dsc || "-" },

      {
        key: "actions",
        title: "عملیات",
        render: (r) => (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate(`/transactions/${r.id}/allocations`)}
            >
              تخصیص‌ها
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/transactions/${r.id}/documents`)}
            >
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
                } catch {
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
    [personsMap, projectsMap, navigate]
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
    } catch {
      toast.error(getApiErrorMessage(e, "خطا در حذف"));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold">تراکنش‌ها (دریافت/پرداخت)</div>
        <Button onClick={() => setQuickAddOpen(true)}>+ جدید</Button>
      </div>

      <div className="mb-3">
        <FiltersBar
          q={q}
          setQ={(v) => {
            setPage(0);
            setQ(v);
          }}
          onClear={() => {
            setPage(0);
            setQ("");
          }}
        />
      </div>

      <div className="mb-3">
        <DataTable
          columns={columns}
          rows={data.content || []}
          loading={loading}
        />
      </div>

      <Pagination
        page={page}
        totalPages={data.totalPages || 0}
        onPage={setPage}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="حذف تراکنش"
        message="آیا از حذف این مورد مطمئن هستید؟"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      <QuickAddTransactionModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async () => {
          await loadLookups();
          setQ("");
          setPage(0);
          await load({ nextQ: "", nextPage: 0 });
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
