import React, { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../layout/AppShell";
import Button from "../common/Button";
import FiltersBar from "../table/FiltersBar";
import DataTable from "../table/DataTable";
import Pagination from "../table/Pagination";
import ConfirmDialog from "../common/ConfirmDialog";
import toast from "react-hot-toast";
import LookupSelect from "../lookup/LookupSelect";
import { normalizeFaText } from "../../utils/normalizeFa";

import { deleteItem, getItemById, getItems, searchItems } from "../../api/itemsApi";
import { getItemCategories } from "../../api/itemCategoriesApi";

import QuickAddItemModal from "./QuickAddItemModal";
import EditItemModal from "./EditItemModal";
import QuickAddItemCategoryModal from "../itemCategories/QuickAddItemCategoryModal";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

function paginate(arr, page, size) {
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * size;
  return {
    content: arr.slice(start, start + size),
    totalPages,
    safePage,
    totalElements: total,
  };
}

export default function ItemsListPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size] = useState(20);

  const [categoryFilter, setCategoryFilter] = useState(null);

  const [loading, setLoading] = useState(false);
  const [all, setAll] = useState([]);

  const [deleteId, setDeleteId] = useState(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // quick add category (used inside item modals)
  const [categoryQuickAddOpen, setCategoryQuickAddOpen] = useState(false);
  const [lastCreatedCategory, setLastCreatedCategory] = useState(null);

  const consumeLastCreatedCategory = useCallback(() => setLastCreatedCategory(null), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trimmed = (q || "").trim();
      const categoryId = categoryFilter?.id || null;

      const res =
        trimmed || categoryId
          ? await searchItems({ q: trimmed, categoryId })
          : await getItems();

      setAll(res || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در دریافت لیست"));
    } finally {
      setLoading(false);
    }
  }, [q, categoryFilter]);

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
  }, [load]);

  async function fetchCategories({ q }) {
    const allCats = await getItemCategories();
    const nq = normalizeFaText(q || "");
    const filtered = !nq
      ? allCats
      : (allCats || []).filter((c) => normalizeFaText(c.title).includes(nq));
    return filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }

  const pageData = useMemo(() => paginate(all, page, size), [all, page, size]);

  useEffect(() => {
    if (pageData.safePage !== page) setPage(pageData.safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageData.safePage]);

  const columns = useMemo(
    () => [
      { key: "id", title: "ID", render: (r) => r.id },
      { key: "categoryTitle", title: "دسته‌بندی", render: (r) => r.categoryTitle || `#${r.categoryId}` },
      { key: "code", title: "کد", render: (r) => <span className="font-mono">{r.code}</span> },
      { key: "title", title: "عنوان", render: (r) => <span className="font-semibold">{r.title}</span> },
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
                  setEditingItem(null);
                  setEditOpen(true);

                  const fresh = await getItemById(r.id);
                  setEditingItem(fresh);
                } catch {
                  toast.error(getApiErrorMessage(e, "خطا در دریافت اطلاعات"));
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
      await deleteItem(deleteId);
      toast.success("حذف شد");
      setDeleteId(null);

      // if last row on page, go back a page
      const isLastRowOnPage = (pageData?.content || []).length <= 1;
      const nextPage = isLastRowOnPage && page > 0 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);

      await load();
    } catch(e) {
      toast.error(getApiErrorMessage(e, "خطا در حذف"));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold">کالا/خدمات</div>
        <Button onClick={() => setQuickAddOpen(true)}>+ جدید</Button>
      </div>

      {/* Filters */}
      <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
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

        <LookupSelect
          label="فیلتر دسته‌بندی"
          value={categoryFilter}
          onChange={(c) => {
            setPage(0);
            setCategoryFilter(c);
          }}
          fetchOptions={fetchCategories}
          display={(c) => c?.title || `#${c?.id}`}
          placeholder="همه دسته‌ها"
        />
      </div>

      <div className="mb-3">
        <DataTable columns={columns} rows={pageData.content || []} loading={loading} />
      </div>

      <Pagination page={page} totalPages={pageData.totalPages || 0} onPage={setPage} />

      <ConfirmDialog
        open={deleteId !== null}
        title="حذف کالا/خدمت"
        message="آیا از حذف این مورد مطمئن هستید؟"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      <QuickAddItemModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async () => {
          setQ("");
          setCategoryFilter(null);
          setPage(0);
          await load();
        }}
        onOpenQuickAddCategory={() => setCategoryQuickAddOpen(true)}
        lastCreatedCategory={lastCreatedCategory}
        consumeLastCreatedCategory={consumeLastCreatedCategory}
      />

      <EditItemModal
        key={editingItem?.id || (editOpen ? "loading" : "closed")}
        open={editOpen}
        item={editingItem}
        loading={editLoading}
        onClose={() => {
          setEditOpen(false);
          setEditingItem(null);
          setEditLoading(false);
        }}
        onUpdated={async () => {
          await load();
        }}
        onOpenQuickAddCategory={() => setCategoryQuickAddOpen(true)}
        lastCreatedCategory={lastCreatedCategory}
        consumeLastCreatedCategory={consumeLastCreatedCategory}
      />

      <QuickAddItemCategoryModal
        open={categoryQuickAddOpen}
        onClose={() => setCategoryQuickAddOpen(false)}
        onCreated={(created) => {
          setLastCreatedCategory(created);
          setCategoryQuickAddOpen(false);
          toast.success("دسته‌بندی جدید اضافه شد");
        }}
      />
    </>
  );
}
