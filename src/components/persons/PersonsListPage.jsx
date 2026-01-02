import React, { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../layout/AppShell";
import Button from "../../components/common/Button";
import FiltersBar from "../../components/table/FiltersBar";
import DataTable from "../../components/table/DataTable";
import Pagination from "../../components/table/Pagination";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import toast from "react-hot-toast";
import {
  deletePerson,
  getPersonById,
  getPersons,
  searchPersons,
} from "../../api/personsApi";
import QuickAddPersonModal from "../../components/persons/QuickAddPersonModal";
import EditPersonModal from "../../components/persons/EditPersonModal";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

function personTypeLabel(isLegal) {
  return isLegal ? "حقوقی" : "حقیقی";
}

function personDisplayName(p) {
  if (!p) return "-";
  if (p.isLegal) return p.companyName || `#${p.id}`;
  const full = `${p.name || ""} ${p.lastName || ""}`.trim();
  return full || p.companyName || `#${p.id}`;
}

export default function PersonsListPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size] = useState(20);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ content: [], totalPages: 0 });

  const [deleteId, setDeleteId] = useState(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const load = useCallback(
    async ({ nextQ = q, nextPage = page } = {}) => {
      setLoading(true);
      try {
        const trimmed = (nextQ || "").trim();
        const res = trimmed
          ? await searchPersons({ q: trimmed, page: nextPage, size })
          : await getPersons({ page: nextPage, size });

        setData(res);
      } catch (e) {
        toast.error(getApiErrorMessage(e, "خطا در دریافت لیست"));
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
    }, 300);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, page, load]);

  const columns = useMemo(
    () => [
      { key: "id", title: "ID", render: (r) => r.id },
      {
        key: "type",
        title: "نوع",
        render: (r) => (
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">
            {personTypeLabel(r.isLegal)}
          </span>
        ),
      },
      {
        key: "display",
        title: "عنوان",
        render: (r) => <span className="font-semibold">{personDisplayName(r)}</span>,
      },
      { key: "name", title: "نام", render: (r) => r.name || "-" },
      { key: "lastName", title: "نام خانوادگی", render: (r) => r.lastName || "-" },
      { key: "companyName", title: "نام سازمان", render: (r) => r.companyName || "-" },
      { key: "tel", title: "تلفن", render: (r) => r.tel || "-" },
      { key: "address", title: "آدرس", render: (r) => r.address || "-" },
      { key: "dsc", title: "توضیحات", render: (r) => r.dsc || "-" },
      {
        key: "actions",
        title: "عملیات",
        render: (r) => (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  setEditLoading(true);
                  setEditingPerson(null);
                  setEditOpen(true);

                  const fresh = await getPersonById(r.id); // IMPORTANT
                  setEditingPerson(fresh);
                } catch (e) {
                  toast.error(getApiErrorMessage(e, "خطا در دریافت اطلاعات شخص"));
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
    []
  );

  async function handleDelete() {
    try {
      await deletePerson(deleteId);
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
        <div className="text-xl font-bold">اشخاص</div>
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
        <DataTable columns={columns} rows={data.content || []} loading={loading} />
      </div>

      <Pagination page={page} totalPages={data.totalPages || 0} onPage={setPage} />

      <ConfirmDialog
        open={deleteId !== null}
        title="حذف شخص"
        message="آیا از حذف این مورد مطمئن هستید؟"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      <QuickAddPersonModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async () => {
          setQ("");
          setPage(0);
          await load({ nextQ: "", nextPage: 0 });
        }}
      />

      <EditPersonModal
        key={editingPerson?.id || (editOpen ? "loading" : "closed")}
        open={editOpen}
        person={editingPerson}
        loading={editLoading}
        onClose={() => {
          setEditOpen(false);
          setEditingPerson(null);
          setEditLoading(false);
        }}
        onUpdated={async () => {
          await load();
        }}
      />
    </>
  );
}
