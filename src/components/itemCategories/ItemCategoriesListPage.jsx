import React, { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../layout/AppShell";
import Button from "../common/Button";
import FiltersBar from "../table/FiltersBar";
import ConfirmDialog from "../common/ConfirmDialog";
import toast from "react-hot-toast";
import { normalizeFaText } from "../../utils/normalizeFa";
import {
  deleteItemCategory,
  getItemCategories,
  getItemCategoryById,
} from "../../api/itemCategoriesApi";
import QuickAddItemCategoryModal from "./QuickAddItemCategoryModal";
import EditItemCategoryModal from "./EditItemCategoryModal";

function buildTree(all) {
  const byId = new Map();
  const childrenByParentId = new Map();

  (all || []).forEach((c) => {
    byId.set(c.id, c);
    const pid = c.parentId ?? null;
    if (!childrenByParentId.has(pid)) childrenByParentId.set(pid, []);
    childrenByParentId.get(pid).push(c);
  });

  // sort children in each group
  for (const [, kids] of childrenByParentId.entries()) {
    kids.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }

  return { byId, childrenByParentId };
}

function flattenTree({ childrenByParentId }, expandedIds, qNorm) {
  const out = [];

  const nodeMatches = (n) =>
    !qNorm || normalizeFaText(n.title || "").includes(qNorm);

  const subtreeHasMatch = (node) => {
    if (nodeMatches(node)) return true;
    const kids = childrenByParentId.get(node.id) || [];
    return kids.some(subtreeHasMatch);
  };

  const walk = (node, level) => {
    const kids = childrenByParentId.get(node.id) || [];
    const hasChildren = kids.length > 0;

    // If search is active: keep only nodes that are in a matching path (node matches or any descendant matches)
    if (qNorm && !subtreeHasMatch(node)) return;

    out.push({
      ...node,
      _level: level,
      _hasChildren: hasChildren,
    });

    const isExpanded = expandedIds.has(node.id);
    if (hasChildren && isExpanded) {
      kids.forEach((k) => walk(k, level + 1));
    }
  };

  const roots = childrenByParentId.get(null) || [];
  roots.forEach((r) => walk(r, 0));

  return out;
}

function collectAllIds(all) {
  const s = new Set();
  (all || []).forEach((c) => s.add(c.id));
  return s;
}

export default function ItemCategoriesListPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [all, setAll] = useState([]);

  const [deleteId, setDeleteId] = useState(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const [expandedIds, setExpandedIds] = useState(new Set()); // Set<number>

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getItemCategories();
      setAll(res || []);

      // expand all by default on first load (or when list changes)
      setExpandedIds((prev) => {
        if (prev && prev.size > 0) return prev;
        return collectAllIds(res || []);
      });
    } catch (e) {
      toast.error("خطا در دریافت لیست");
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [load]);

  const treeIndex = useMemo(() => buildTree(all), [all]);
  const qNorm = useMemo(() => normalizeFaText(q || ""), [q]);

  const flatRows = useMemo(
    () => flattenTree(treeIndex, expandedIds, qNorm),
    [treeIndex, expandedIds, qNorm]
  );

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(collectAllIds(all));
  }, [all]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  async function handleDelete() {
    try {
      await deleteItemCategory(deleteId);
      toast.success("حذف شد");
      setDeleteId(null);

      await load();
    } catch {
      toast.error("خطا در حذف");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold">دسته‌بندی‌ها</div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={expandAll}>
            باز کردن همه
          </Button>
          <Button variant="secondary" onClick={collapseAll}>
            بستن همه
          </Button>
          <Button onClick={() => setQuickAddOpen(true)}>+ جدید</Button>
        </div>
      </div>

      <div className="mb-3">
        <FiltersBar
          q={q}
          setQ={(v) => setQ(v)}
          onClear={() => setQ("")}
        />
      </div>

      {/* Tree Table */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0">
              <tr>
                <th className="text-right px-4 py-3 font-semibold text-zinc-700 whitespace-nowrap">
                  دسته‌بندی (کد - عنوان)
                </th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-700 whitespace-nowrap">
                  توضیحات
                </th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-700 whitespace-nowrap">
                  عملیات
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={3}>
                    در حال بارگذاری...
                  </td>
                </tr>
              ) : flatRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-zinc-500" colSpan={3}>
                    موردی یافت نشد
                  </td>
                </tr>
              ) : (
                flatRows.map((r) => {
                  const isExpanded = expandedIds.has(r.id);
                  const indentPx = r._level * 18;

                  return (
                    <tr key={r.id} className="border-t hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingRight: indentPx }}
                        >
                          {r._hasChildren ? (
                            <button
                              type="button"
                              className="w-6 h-6 rounded-md hover:bg-zinc-100 flex items-center justify-center text-zinc-700"
                              onClick={() => toggleExpand(r.id)}
                              title={isExpanded ? "بستن" : "باز کردن"}
                            >
                              {isExpanded ? "▾" : "▸"}
                            </button>
                          ) : (
                            <span className="w-6 h-6 inline-block" />
                          )}

                          <span className="font-semibold">
                            {r.id} - {r.title}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.dsc || "-"}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              try {
                                setEditLoading(true);
                                setEditingCategory(null);
                                setEditOpen(true);

                                const fresh = await getItemCategoryById(r.id);
                                setEditingCategory(fresh);
                              } catch {
                                toast.error("خطا در دریافت اطلاعات");
                                setEditOpen(false);
                              } finally {
                                setEditLoading(false);
                              }
                            }}
                          >
                            ویرایش
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => setDeleteId(r.id)}
                          >
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="حذف دسته‌بندی"
        message="آیا از حذف این مورد مطمئن هستید؟"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      <QuickAddItemCategoryModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async () => {
          setQ("");
          await load();
        }}
      />

      <EditItemCategoryModal
        key={editingCategory?.id || (editOpen ? "loading" : "closed")}
        open={editOpen}
        category={editingCategory}
        loading={editLoading}
        onClose={() => {
          setEditOpen(false);
          setEditingCategory(null);
          setEditLoading(false);
        }}
        onUpdated={async () => {
          await load();
        }}
      />
    </>
  );
}
