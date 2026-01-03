import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../common/Button";
import FiltersBar from "../table/FiltersBar";
import DataTable from "../table/DataTable";
import Pagination from "../table/Pagination";
import ConfirmDialog from "../common/ConfirmDialog";
import toast from "react-hot-toast";
import { deleteUnit, getUnitById, getUnits } from "../../api/unitsApi";
import QuickAddUnitModal from "./QuickAddUnitModal";
import EditUnitModal from "./EditUnitModal";
import { normalizeFaText } from "../../utils/normalizeFa";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

export default function UnitsListPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size] = useState(20);

  const [loading, setLoading] = useState(false);
  const [allRows, setAllRows] = useState([]);

  const [deleteId, setDeleteId] = useState(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUnits();
      setAllRows(Array.isArray(res) ? res : []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در دریافت لیست"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const nq = normalizeFaText(q || "");
    if (!nq) return allRows;

    return allRows.filter((u) => {
      const t = normalizeFaText(u?.title || "");
      const d = normalizeFaText(u?.dsc || "");
      return t.includes(nq) || d.includes(nq) || String(u?.id || "").includes(nq);
    });
  }, [allRows, q]);

  const totalPages = useMemo(() => {
    const len = filtered.length;
    return len === 0 ? 0 : Math.ceil(len / size);
  }, [filtered.length, size]);

  const pagedRows = useMemo(() => {
    const start = page * size;
    return filtered.slice(start, start + size);
  }, [filtered, page, size]);

  useEffect(() => {
    // اگر سرچ عوض شد و صفحه از محدوده خارج شد
    if (page > 0 && totalPages > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
    if (totalPages === 0) setPage(0);
  }, [totalPages, page]);

  const columns = useMemo(
    () => [
      { key: "id", title: "ID", render: (r) => r.id },
      {
        key: "title",
        title: "عنوان",
        render: (r) => <span className="font-semibold">{r.title}</span>,
      },
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
                  setEditingUnit(null);
                  setEditOpen(true);

                  const fresh = await getUnitById(r.id);
                  setEditingUnit(fresh);
                } catch (e) {
                  toast.error(getApiErrorMessage(e, "خطا در دریافت اطلاعات واحد"));
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
      await deleteUnit(deleteId);
      toast.success("حذف شد");
      setDeleteId(null);

      await load();
    } catch(e) {
      toast.error(getApiErrorMessage(e, "خطا در حذف"));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold">واحدها</div>
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
        <DataTable columns={columns} rows={pagedRows} loading={loading} />
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      <ConfirmDialog
        open={deleteId !== null}
        title="حذف واحد"
        message="آیا از حذف این مورد مطمئن هستید؟"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      <QuickAddUnitModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async () => {
          setQ("");
          setPage(0);
          await load();
        }}
      />

      <EditUnitModal
        key={editingUnit?.id || (editOpen ? "loading" : "closed")}
        open={editOpen}
        unit={editingUnit}
        loading={editLoading}
        onClose={() => {
          setEditOpen(false);
          setEditingUnit(null);
          setEditLoading(false);
        }}
        onUpdated={async () => {
          await load();
        }}
      />
    </>
  );
}
