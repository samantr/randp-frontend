import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../common/Button";
import FiltersBar from "../table/FiltersBar";
import ConfirmDialog from "../common/ConfirmDialog";
import toast from "react-hot-toast";
import { normalizeFaText } from "../../utils/normalizeFa";
import { deleteProject, getProjectById, getProjects } from "../../api/projectsApi";
import QuickAddProjectModal from "./QuickAddProjectModal";
import EditProjectModal from "./EditProjectModal";

function buildTree(all) {
  const byId = new Map();
  const childrenByParentId = new Map();

  (all || []).forEach((p) => {
    byId.set(p.id, p);
    const pid = p.parentId ?? null;
    if (!childrenByParentId.has(pid)) childrenByParentId.set(pid, []);
    childrenByParentId.get(pid).push(p);
  });

  for (const [, kids] of childrenByParentId.entries()) {
    kids.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }

  return { byId, childrenByParentId };
}

function collectAllIds(all) {
  const s = new Set();
  (all || []).forEach((p) => s.add(p.id));
  return s;
}

function flattenTree({ childrenByParentId }, expandedIds, qNorm) {
  const out = [];

  const nodeMatches = (n) => {
    if (!qNorm) return true;
    const t = normalizeFaText(String(n?.title ?? ""));
    const c = normalizeFaText(String(n?.code ?? ""));
    return t.includes(qNorm) || c.includes(qNorm);
  };

  const subtreeHasMatch = (node) => {
    if (nodeMatches(node)) return true;
    const kids = childrenByParentId.get(node.id) || [];
    return kids.some(subtreeHasMatch);
  };

  const walk = (node, level) => {
    const kids = childrenByParentId.get(node.id) || [];
    const hasChildren = kids.length > 0;

    if (qNorm && !subtreeHasMatch(node)) return;

    out.push({ ...node, _level: level, _hasChildren: hasChildren });

    if (hasChildren && expandedIds.has(node.id)) {
      kids.forEach((k) => walk(k, level + 1));
    }
  };

  const roots = childrenByParentId.get(null) || [];
  roots.forEach((r) => walk(r, 0));

  return out;
}

export default function ProjectsListPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [all, setAll] = useState([]);

  const [deleteId, setDeleteId] = useState(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const [expandedIds, setExpandedIds] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjects();
      setAll(res || []);

      setExpandedIds((prev) => {
        if (prev && prev.size > 0) return prev;
        return collectAllIds(res || []);
      });
    } catch {
      toast.error("خطا در دریافت لیست پروژه‌ها");
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

  const expandAll = useCallback(() => setExpandedIds(collectAllIds(all)), [all]);
  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

  async function handleDelete() {
    try {
      await deleteProject(deleteId);
      toast.success("حذف شد");
      setDeleteId(null);
      await load();
    } catch {
      toast.error("خطا در حذف پروژه");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold">پروژه‌ها</div>
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
        <FiltersBar q={q} setQ={setQ} onClear={() => setQ("")} />
      </div>

      {/* Tree Table */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0">
              <tr>
                <th className="text-right px-4 py-3 font-semibold text-zinc-700 whitespace-nowrap">
                  پروژه (کد - عنوان)
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
                  const label = r.code ? `${r.code} - ${r.title}` : `${r.id} - ${r.title}`;

                  return (
                    <tr key={r.id} className="border-t hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" style={{ paddingRight: indentPx }}>
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

                          <span className="font-semibold">{label}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">{r.dsc || "-"}</td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              try {
                                setEditLoading(true);
                                setEditingProject(null);
                                setEditOpen(true);

                                const fresh = await getProjectById(r.id);
                                setEditingProject(fresh);
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
                          <Button variant="danger" onClick={() => setDeleteId(r.id)}>
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
        title="حذف پروژه"
        message="آیا از حذف این مورد مطمئن هستید؟"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      <QuickAddProjectModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async () => {
          setQ("");
          await load();
        }}
      />

      <EditProjectModal
        key={editingProject?.id || (editOpen ? "loading" : "closed")}
        open={editOpen}
        project={editingProject}
        loading={editLoading}
        onClose={() => {
          setEditOpen(false);
          setEditingProject(null);
          setEditLoading(false);
        }}
        onUpdated={async () => {
          await load();
        }}
      />
    </>
  );
}
