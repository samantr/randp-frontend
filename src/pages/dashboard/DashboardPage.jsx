import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

// ✅ use working ones from dashboardApi (axios-based)
import {
  getDashboardSummary,
  getLastRefresh,
  getTopPayers,
  getTopReceivers,
  refreshDashboardMart,
  getPersonsSummary,
  getPersonPayables,
  getItemsByCategory,
  getItemCategoriesTree,
  getDebtAgingByPerson,
  downloadPersonOperationsExcel,
} from "../../api/dashboardApi";

import api from "../../api/axios";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from "recharts";

/* ======================
   Jalali Date Picker
   ====================== */
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";

/* ======================
   UI Helpers
   ====================== */
const COLORS = [
  "#2563EB", // blue
  "#DC2626", // red
  "#16A34A", // green
  "#F59E0B", // amber
  "#7C3AED", // purple
  "#06B6D4", // cyan
  "#F97316", // orange
  "#DB2777", // pink
];

function formatNumber(x) {
  try {
    if (x === null || x === undefined) return "۰";
    const n = typeof x === "string" ? Number(x) : x;
    return new Intl.NumberFormat("fa-IR").format(n);
  } catch {
    return String(x ?? "۰");
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10); // yyyy-MM-dd
}
function addDaysISO(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildCategoryTree(flatRows) {
  const byId = new Map();
  const roots = [];

  (flatRows || []).forEach((r) => {
    const id = r.itemCategoryId ?? r.item_category_id;
    const parentId = r.parentItemCategoryId ?? r.parent_item_category_id;

    byId.set(id, { ...r, id, parentId, children: [] });
  });

  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortRec = (arr) => {
    arr.sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), "fa"),
    );
    arr.forEach((x) => sortRec(x.children || []));
  };
  sortRec(roots);

  return roots;
}

// open Debts page in a new tab, filtered by clicked item
function openDebtsByItemInNewTab(it) {
  const id = it?.itemId ?? it?.item_id ?? it?.id;
  if (!id) return;

  // Debts page reads item filter from query param: iid
  const url = `/debts?iid=${encodeURIComponent(id)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ======================
   ISO <-> Jalali helpers
   ====================== */
function isoToPersianDateObject(iso) {
  if (!iso) return null;
  // parse ISO as Gregorian, then convert to Persian for display
  const d = new DateObject({
    date: iso,
    calendar: gregorian,
    locale: persian_fa,
  });
  return d.convert(persian);
}

function persianDateObjectToIso(pDateObj) {
  if (!pDateObj) return null;
  const g = pDateObj.convert(gregorian);
  // ensure YYYY-MM-DD
  const yyyy = String(g.year).padStart(4, "0");
  const mm = String(g.month.number).padStart(2, "0");
  const dd = String(g.day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ======================
   Mini Components
   ====================== */
function Card({ title, children }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-4">
      {title ? (
        <div className="text-sm font-semibold text-zinc-700 mb-2">{title}</div>
      ) : null}
      {children}
    </div>
  );
}

function MiniTable({ title, subtitle, children }) {
  return (
    <Card title={title}>
      {subtitle ? (
        <div className="text-xs text-zinc-500 mb-3">{subtitle}</div>
      ) : null}
      {children}
    </Card>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-semibold">{title}</div>
          <button
            className="px-3 py-1 text-xs rounded-lg border hover:bg-zinc-50"
            onClick={onClose}
          >
            بستن
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function PieCard({ title, rows }) {
  const data = (rows || []).map((r) => ({
    name: r.title ?? r.displayName ?? r.display_name ?? "-",
    value: Number(r.amount ?? r.totalPaid ?? r.totalReceived ?? 0),
  }));

  return (
    <Card title={title}>
      {data.length === 0 ? (
        <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatNumber(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ======================
   Custom API helpers (existing)
   ====================== */
async function apiGetOpenDebtsCoverage({ from, to, limit }) {
  const res = await api.get("/api/v1/dashboard/open-debts-coverage", {
    params: { from, to, limit },
  });
  return res.data;
}

async function apiGetUnallocatedOverview({ from, to, limit }) {
  const res = await api.get("/api/v1/dashboard/unallocated", {
    params: { from, to, limit },
  });
  return res.data;
}

async function apiGetRecentActivities({ limit }) {
  const res = await api.get("/api/v1/dashboard/recent-activities", {
    params: { limit },
  });
  return res.data;
}

async function apiGetExecutiveKpis({ from, to, asOf }) {
  const res = await api.get("/api/v1/dashboard/executive-kpis", {
    params: { from, to, asOf },
  });
  return res.data;
}

/* ======================
   Page
   ====================== */
export default function DashboardPage() {
  // default range: last 30 days
  const [from, setFrom] = useState(addDaysISO(todayISO(), -1000));
  const [to, setTo] = useState(todayISO());

  const fromPersian = useMemo(() => isoToPersianDateObject(from), [from]);
  const toPersian = useMemo(() => isoToPersianDateObject(to), [to]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [kpis, setKpis] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // pie charts
  const [topPayers, setTopPayers] = useState([]);
  const [topReceivers, setTopReceivers] = useState([]);

  // persons drill
  const [personsSummary, setPersonsSummary] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personPayables, setPersonPayables] = useState([]);
  const [payablesLoading, setPayablesLoading] = useState(false);

  // item categories drill (tree)
  const [itemCategoriesTree, setItemCategoriesTree] = useState([]);
  const [expandedCats, setExpandedCats] = useState(() => new Set());
  const [selectedItemCategory, setSelectedItemCategory] = useState(null);
  const [itemsByCategory, setItemsByCategory] = useState([]);
  const [itemsByCategoryLoading, setItemsByCategoryLoading] = useState(false);

  // debt aging (person only) — simplified columns
  const [debtAgingPersons, setDebtAgingPersons] = useState([]);

  // open debts vs covered
  const [openDebtsCoverage, setOpenDebtsCoverage] = useState([]);

  // unallocated overview
  const [unallocatedOpenDebts, setUnallocatedOpenDebts] = useState([]);
  const [unallocatedExpenseTxs, setUnallocatedExpenseTxs] = useState([]);

  // recent activity feed
  const [recentActivities, setRecentActivities] = useState([]);

  // executive totals (only used for 2 cards)
  const [execKpis, setExecKpis] = useState(null);

  // --- helpers (paste near top of DashboardPage.jsx) ---
  const openInNewTab = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const moneyCellLinkStyle = {
    cursor: "pointer",
    color: "var(--primary, #1677ff)",
    textDecoration: "underline",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  async function loadAll() {
    setLoading(true);
    setSelectedItemCategory(null);
    setItemsByCategory([]);
    const calls = {
      summary: () => getDashboardSummary({ from, to }),
      topPayers: () => getTopPayers({ from, to, limit: 10 }),
      topReceivers: () => getTopReceivers({ from, to, limit: 10 }),
      lastRefresh: () => getLastRefresh(),

      personsSummary: () => getPersonsSummary({ from, to, limit: 50 }),
      itemCategoriesTree: () =>
        getItemCategoriesTree({ from, to, onlyActive: true }),

      // simplified aging: still fetched, but UI shows only person + open_total
      debtAgingPersons: () =>
        getDebtAgingByPerson({ from, to, asOf: to, limit: 50 }),

      openDebtsCoverage: () => apiGetOpenDebtsCoverage({ from, to, limit: 50 }),

      unallocatedOverview: () =>
        apiGetUnallocatedOverview({ from, to, limit: 50 }),

      recentActivities: () => apiGetRecentActivities({ limit: 20 }),

      executiveKpis: () => apiGetExecutiveKpis({ from, to, asOf: to }),
    };

    try {
      const entries = Object.entries(calls);
      const results = await Promise.allSettled(entries.map(([, fn]) => fn()));

      const get = (key) => {
        const idx = entries.findIndex(([k]) => k === key);
        const r = results[idx];
        return r?.status === "fulfilled" ? r.value : undefined;
      };

      const s = get("summary");
      if (s !== undefined) setKpis(s);

      const tp = get("topPayers");
      if (tp !== undefined) setTopPayers(tp || []);

      const tr = get("topReceivers");
      if (tr !== undefined) setTopReceivers(tr || []);

      const lr = get("lastRefresh");
      if (lr !== undefined) setLastRefresh(lr);

      const ps = get("personsSummary");
      if (ps !== undefined) setPersonsSummary(ps || []);

      const ict = get("itemCategoriesTree");
      if (ict !== undefined) {
        setItemCategoriesTree(ict || []);
        // default: expand root nodes once
        setExpandedCats((prev) => {
          if (prev && prev.size > 0) return prev;
          const next = new Set();
          (ict || []).forEach((r) => {
            const parentId =
              r.parentItemCategoryId ?? r.parent_item_category_id;
            if (!parentId) {
              const id = r.itemCategoryId ?? r.item_category_id;
              next.add(id);
            }
          });
          return next;
        });
      }

      const dap = get("debtAgingPersons");
      if (dap !== undefined) setDebtAgingPersons(dap || []);

      const odc = get("openDebtsCoverage");
      if (odc !== undefined) setOpenDebtsCoverage(odc || []);

      const uo = get("unallocatedOverview");
      if (uo !== undefined) {
        setUnallocatedOpenDebts(uo?.openDebts || uo?.open_debts || []);
        setUnallocatedExpenseTxs(
          uo?.unallocatedExpenses || uo?.unallocated_expenses || [],
        );
      }

      const ra = get("recentActivities");
      if (ra !== undefined) setRecentActivities(ra || []);

      const ek = get("executiveKpis");
      if (ek !== undefined) setExecKpis(ek);

      // show failures with real reason
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const key = entries[i][0];
          console.error(`[Dashboard] ${key} failed:`, r.reason);
          toast.error(`${key}: ${getApiErrorMessage(r.reason) || "خطا"}`);
        }
      });
    } finally {
      setLoading(false);
    }
  }

  async function onRefreshMart() {
    setRefreshing(true);
    try {
      const res = await refreshDashboardMart();
      setLastRefresh(res);
      toast.success("به‌روزرسانی داشبورد انجام شد");
      await loadAll();
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "خطا");
    } finally {
      setRefreshing(false);
    }
  }

  async function openPersonPayables(p) {
    setSelectedPerson({ personId: p.personId, displayName: p.displayName });
    setPersonPayables([]);
    setPayablesLoading(true);
    try {
      const rows = await getPersonPayables({
        personId: p.personId,
        from,
        to,
        limit: 100,
      });
      setPersonPayables(rows || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "خطا");
    } finally {
      setPayablesLoading(false);
    }
  }

  async function onDownloadPersonExcel(e, p) {
  e.stopPropagation();

  try {
    await downloadPersonOperationsExcel({
      personId: p.personId,
      displayName: p.displayName,
      from,
      to,
    });

    toast.success("فایل اکسل ساخته شد");
  } catch (err) {
    console.error(err);
    toast.error(getApiErrorMessage(err) || "خطا در ساخت فایل اکسل");
  }
}

  async function openItemCategoryDrill(c) {
    const id = c.itemCategoryId ?? c.item_category_id;
    const title = c.title ?? "-";

    setSelectedItemCategory({
      itemCategoryId: id,
      title,
    });
    setItemsByCategory([]);
    setItemsByCategoryLoading(true);
    try {
      const rows = await getItemsByCategory({
        itemCategoryId: id,
        from,
        to,
        limit: 150,
      });
      setItemsByCategory(rows || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "خطا");
    } finally {
      setItemsByCategoryLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold">داشبورد</div>
          <div className="text-xs text-zinc-500">
            {lastRefresh?.refreshedAt
              ? `آخرین بروزرسانی: ${lastRefresh.refreshedAt}`
              : "آخرین بروزرسانی: -"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">از</span>
            <DatePicker
              calendar={persian}
              locale={persian_fa}
              value={fromPersian}
              onChange={(d) => {
                const iso = persianDateObjectToIso(d);
                if (iso) setFrom(iso);
              }}
              inputClass="border rounded-lg px-3 py-2 text-sm w-[150px]"
              containerClassName="rtl"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">تا</span>
            <DatePicker
              calendar={persian}
              locale={persian_fa}
              value={toPersian}
              onChange={(d) => {
                const iso = persianDateObjectToIso(d);
                if (iso) setTo(iso);
              }}
              inputClass="border rounded-lg px-3 py-2 text-sm w-[150px]"
              containerClassName="rtl"
            />
          </div>

          <button
            className="px-4 py-2 rounded-lg border text-sm hover:bg-zinc-50 disabled:opacity-50"
            onClick={loadAll}
            disabled={loading}
          >
            اعمال
          </button>

          <button
            className="px-4 py-2 rounded-lg bg-black text-white text-sm hover:bg-black/90 disabled:opacity-50"
            onClick={onRefreshMart}
            disabled={refreshing}
          >
            {refreshing ? "در حال بروزرسانی..." : "بروزرسانی Mart"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="جمع بدهی‌ها (DEBTS)">
          <div className="text-2xl font-bold">
            {formatNumber(kpis?.totalDebtAmount ?? kpis?.total_debt_amount)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            بازه تاریخ انتخاب‌ شده
          </div>
        </Card>

        <Card title="جمع پرداخت‌ها (PAYMENTS)">
          <div className="text-2xl font-bold">
            {formatNumber(
              kpis?.totalTransactionsAmount ?? kpis?.total_transactions_amount,
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            بازه تاریخ انتخاب‌شده
          </div>
        </Card>
      
      </div>

      {/* Executive totals (2 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border rounded-2xl shadow-sm p-4">
          <div className="text-xs text-zinc-500">جمع هزینه‌ها (EXP)</div>
          <div className="text-2xl font-bold mt-1">
            {formatNumber(
              execKpis?.totalExpenseAmount ?? execKpis?.total_expense_amount,
            )}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            شامل پرداخت‌هایی که از نوع هزینه ثبت شده‌اند.
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-4">
          <div className="text-xs text-zinc-500">جمع تنخواه (TRN)</div>
          <div className="text-2xl font-bold mt-1">
            {formatNumber(
              execKpis?.totalTankhahAmount ?? execKpis?.total_tankhah_amount,
            )}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            تنخواه الزاماً نیاز به تخصیص ندارد.
          </div>
        </div>
      </div>

      {/* Pies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PieCard title="بیشترین پرداخت‌کنندگان" rows={topPayers} />
        <PieCard title="بیشترین دریافت‌کنندگان" rows={topReceivers} />
      </div>

      {/* Item Categories drill (TREE + INLINE ITEMS) */}
      <MiniTable
        title="دسته‌بندی‌های کالا/خدمات (Drill)"
        subtitle="درخت را باز/بسته کنید؛ روی دسته کلیک کنید تا آیتم‌های آن (و زیرمجموعه‌ها) نمایش داده شود"
      >
        {itemCategoriesTree.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Left: Tree */}
            <div className="border rounded-xl p-3">
              <div className="text-sm font-semibold mb-2">درخت دسته‌بندی</div>

              <div className="max-h-[420px] overflow-auto">
                {(() => {
                  const roots = buildCategoryTree(itemCategoriesTree);

                  const Row = ({ node, depth }) => {
                    const id = node.id;
                    const hasChildren = (node.children?.length || 0) > 0;
                    const isOpen = expandedCats.has(id);

                    const amount =
                      node.amount ?? node.totalDebt ?? node.total_debt;
                    const allocatedAmount =
                      node.allocatedAmount ??
                      node.allocated_amount ??
                      node.totalAllocated ??
                      node.total_allocated;
                    const remaining =
                      node.remaining ?? node.remain ?? node.remained;

                    return (
                      <div>
                        <div
                          className={`flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-zinc-50 cursor-pointer ${
                            selectedItemCategory?.itemCategoryId === id
                              ? "bg-zinc-100"
                              : ""
                          }`}
                          style={{ paddingRight: 8 + depth * 18 }}
                          onClick={() =>
                            openItemCategoryDrill({
                              itemCategoryId: id,
                              title: node.title,
                            })
                          }
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasChildren) return;
                              setExpandedCats((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              });
                            }}
                            className={`w-6 h-6 flex items-center justify-center rounded-md border bg-white hover:bg-zinc-50 ${
                              hasChildren ? "" : "opacity-40 cursor-default"
                            }`}
                            title={
                              hasChildren
                                ? isOpen
                                  ? "بستن"
                                  : "باز کردن"
                                : "بدون زیرمجموعه"
                            }
                          >
                            {hasChildren ? (isOpen ? "▾" : "▸") : "•"}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate">{node.title}</div>
                            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                              بدهی: {formatNumber(amount)} | تخصیص:{" "}
                              {formatNumber(allocatedAmount)} | مانده:{" "}
                              {formatNumber(remaining)}
                            </div>
                          </div>
                        </div>

                        {hasChildren && isOpen ? (
                          <div>
                            {node.children.map((ch) => (
                              <Row key={ch.id} node={ch} depth={depth + 1} />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  };

                  return roots.map((r) => (
                    <Row key={r.id} node={r} depth={0} />
                  ));
                })()}
              </div>
            </div>

            {/* Right: Items list (category + descendants) */}
            <div className="border rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <div className="text-sm font-semibold">آیتم‌ها</div>
                  <div className="text-[11px] text-zinc-500">
                    {selectedItemCategory?.title
                      ? `دسته انتخاب‌شده: ${selectedItemCategory.title} (شامل زیرمجموعه‌ها)`
                      : "برای نمایش، یک دسته را از درخت انتخاب کنید"}
                  </div>
                </div>

                {selectedItemCategory ? (
                  <button
                    className="px-3 py-1 text-xs rounded-lg border hover:bg-zinc-50"
                    onClick={() => {
                      setSelectedItemCategory(null);
                      setItemsByCategory([]);
                    }}
                  >
                    پاک کردن انتخاب
                  </button>
                ) : null}
              </div>

              {itemsByCategoryLoading ? (
                <div className="text-xs text-zinc-500">در حال دریافت...</div>
              ) : !selectedItemCategory ? (
                <div className="text-xs text-zinc-500">
                  یک دسته را انتخاب کنید.
                </div>
              ) : itemsByCategory.length === 0 ? (
                <div className="text-xs text-zinc-500">آیتمی یافت نشد</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead>
                      <tr className="text-xs text-zinc-600 border-b">
                        <th className="text-right py-2">آیتم</th>
                        <th className="text-left py-2">جمع بدهی</th>
                        <th className="text-left py-2">پرداخت/تخصیص</th>
                        <th className="text-left py-2">مانده</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsByCategory.map((it, idx) => (
                        <tr
                          key={`${it.itemId ?? it.item_id ?? idx}`}
                          className="border-b"
                        >
                          <td className="py-2 text-right">{it.title}</td>
                          <td className="py-2 text-left">
                            <button
                              type="button"
                              className="font-mono text-blue-600 hover:underline disabled:opacity-50 disabled:no-underline"
                              onClick={() => openDebtsByItemInNewTab(it)}
                              disabled={!Number(it?.amount)}
                              title="نمایش بدهی‌های این آیتم"
                            >
                              {formatNumber(it.amount)}
                            </button>
                          </td>

                          <td className="py-2 text-left font-mono">
                            {formatNumber(it.allocatedAmount)}
                          </td>
                          <td className="py-2 text-left font-mono">
                            {formatNumber(it.remaining)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </MiniTable>

      {/* Persons drill */}
      <MiniTable
        title="اشخاص"
        subtitle="کلیک روی شخص برای دیدن بدهی‌های قابل پرداخت"
      >
        {personsSummary.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-600 border-b">
                  <th className="text-right py-2">شخص</th>
                  <th className="text-left py-2">جمع بدهی</th>
                  <th className="text-left py-2">جمع پرداختی</th>
                  <th className="text-left py-2">جمع دریافتی</th>
                  <th className="text-left py-2">مانده</th>
                  <th className="text-center py-2">خروجی</th>
                </tr>
              </thead>
              <tbody>
                {personsSummary.map((p) => (
                  <tr
                    key={p.personId}
                    className="border-b hover:bg-zinc-50 cursor-pointer transition"
                    onClick={() => openPersonPayables(p)}
                    title="کلیک برای Drill"
                  >
                    <td className="py-2 text-right">{p.displayName}</td>
                    <td
                      className="py-2 text-left font-mono text-blue-600 underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation(); // ⛔ نذار row click اجرا بشه
                        openInNewTab(`/debts?pid=${p.personId}`);
                      }}
                      title="نمایش بدهی‌های این شخص"
                    >
                      {formatNumber(p.totalDebt)}
                    </td>

                    <td
                      className="py-2 text-left font-mono text-blue-600 underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation(); // ⛔ نذار click ردیف اجرا بشه
                        window.open(
                          `/transactions?fromPid=${encodeURIComponent(p.personId)}`,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }}
                      title="نمایش تراکنش‌های پرداختی این شخص"
                    >
                      {formatNumber(p.totalPaid)}
                    </td>

                    <td
                      className="py-2 text-left font-mono text-blue-600 underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        openInNewTab(`/transactions?toPid=${p.personId}`);
                      }}
                      title="نمایش تراکنش‌های دریافتی"
                    >
                      {formatNumber(p.totalReceived)}
                    </td>

                    <td className="py-2 text-left font-mono">
                      {formatNumber(p.remain)}
                    </td>

                    <td className="py-2 text-center">
                      <button
                        type="button"
                        className="px-3 py-1 text-xs rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                        onClick={(e) => onDownloadPersonExcel(e, p)}
                        title="دانلود گزارش عملیات شخص"
                      >
                        Excel
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MiniTable>

      {/* Debt Aging (simplified) */}
      <MiniTable
        title="گزارش سررسید بدهی‌ها (اشخاص)"
        subtitle="فقط جمع مانده بدهی‌های باز (ستون‌های بازه حذف شدند)"
      >
        {debtAgingPersons.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-600 border-b">
                  <th className="text-right py-2">شخص</th>
                  <th className="text-left py-2">جمع مانده</th>
                </tr>
              </thead>
              <tbody>
                {debtAgingPersons.map((r) => (
                  <tr key={r.person_id ?? r.personId} className="border-b">
                    <td className="py-2 text-right">
                      {r.display_name ?? r.displayName}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(r.open_total ?? r.openTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MiniTable>

      {/* Open Debts vs Covered */}
      <MiniTable
        title="بدهی‌های باز / میزان پوشش"
        subtitle="نمایش بدهی‌هایی که هنوز مانده دارند (بازه تاریخ انتخاب‌شده)"
      >
        {openDebtsCoverage.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-600 border-b">
                  <th className="text-right py-2">ID</th>
                  <th className="text-right py-2">تاریخ</th>
                  <th className="text-right py-2">شخص</th>
                  <th className="text-right py-2">پروژه</th>
                  <th className="text-left py-2">جمع بدهی</th>
                  <th className="text-left py-2">جمع پوشش</th>
                  <th className="text-left py-2">مانده</th>
                </tr>
              </thead>
              <tbody>
                {openDebtsCoverage.map((r, idx) => (
                  <tr
                    key={`${r.debt_id ?? r.debtId ?? idx}`}
                    className="border-b"
                  >
                    <td className="py-2 text-right">{r.debt_id ?? r.debtId}</td>
                    <td className="py-2 text-right">
                      {r.debt_date ?? r.debtDate}
                    </td>
                    <td className="py-2 text-right">
                      {r.person_name ?? r.personName}
                    </td>
                    <td className="py-2 text-right">
                      {r.project_title ?? r.projectTitle}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(r.total_debt ?? r.totalDebt)}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(r.allocated_amount ?? r.allocatedAmount)}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(r.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MiniTable>

      {/* Unallocated Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MiniTable title="بدهی‌های باز بدون تخصیص" subtitle="Top 50">
          {unallocatedOpenDebts.length === 0 ? (
            <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-600 border-b">
                    <th className="text-right py-2">ID</th>
                    <th className="text-right py-2">تاریخ</th>
                    <th className="text-right py-2">شخص</th>
                    <th className="text-right py-2">پروژه</th>
                    <th className="text-left py-2">جمع بدهی</th>
                    <th className="text-left py-2">مانده</th>
                  </tr>
                </thead>
                <tbody>
                  {unallocatedOpenDebts.map((r, idx) => (
                    <tr
                      key={`${r.debt_id ?? r.debtId ?? idx}`}
                      className="border-b"
                    >
                      <td className="py-2 text-right">
                        {r.debt_id ?? r.debtId}
                      </td>
                      <td className="py-2 text-right">
                        {r.debt_date ?? r.debtDate}
                      </td>
                      <td className="py-2 text-right">
                        {r.person_name ?? r.personName}
                      </td>
                      <td className="py-2 text-right">
                        {r.project_title ?? r.projectTitle}
                      </td>
                      <td className="py-2 text-left font-mono">
                        {formatNumber(r.total_debt ?? r.totalDebt)}
                      </td>
                      <td className="py-2 text-left font-mono">
                        {formatNumber(r.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MiniTable>

        <MiniTable title="هزینه‌های بدون تخصیص" subtitle="Top 50">
          {unallocatedExpenseTxs.length === 0 ? (
            <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-600 border-b">
                    <th className="text-right py-2">ID</th>
                    <th className="text-right py-2">تاریخ</th>
                    <th className="text-right py-2">شخص</th>
                    {/* <th className="text-right py-2">پروژه</th> */}
                    <th className="text-left py-2">مبلغ</th>
                    <th className="text-left py-2">تخصیص</th>
                    <th className="text-left py-2">مانده</th>
                  </tr>
                </thead>
                <tbody>
                  {unallocatedExpenseTxs.map((r, idx) => (
                    <tr
                      key={`${r.transaction_id ?? r.transactionId ?? idx}`}
                      className="border-b"
                    >
                      <td className="py-2 text-right">
                        {r.transaction_id ?? r.transactionId}
                      </td>
                      <td className="py-2 text-right">
                        {r.tx_date ?? r.txDate}
                      </td>
                      <td className="py-2 text-right">
                        {r.to_person_name ?? r.toPersonName}
                      </td>
                      {/*<td className="py-2 text-right">
                        {r.project_title ?? r.projectTitle}
                      </td> */}
                      <td className="py-2 text-left font-mono">
                        {formatNumber(r.amount)}
                      </td>
                      <td className="py-2 text-left font-mono">
                        {formatNumber(r.allocated)}
                      </td>
                      <td className="py-2 text-left font-mono">
                        {formatNumber(r.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MiniTable>
      </div>

      {/* Recent activities */}
      {/*<MiniTable title="فعالیت‌های اخیر" subtitle="آخرین ۲۰ رویداد">
        {recentActivities.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-600 border-b">
                  <th className="text-right py-2">تاریخ</th>
                  <th className="text-right py-2">نوع</th>
                  <th className="text-right py-2">توضیح</th>
                  <th className="text-left py-2">مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.map((r, idx) => (
                  <tr key={`${r.id ?? idx}`} className="border-b">
                    <td className="py-2 text-right">
                      {r.created_at ?? r.createdAt}
                    </td>
                    <td className="py-2 text-right">{r.type}</td>
                    <td className="py-2 text-right">{r.description}</td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MiniTable>*/}

      {/* Person Payables Modal */}
      <Modal
        open={!!selectedPerson}
        title={
          selectedPerson?.displayName
            ? `بدهی‌های قابل پرداخت: ${selectedPerson.displayName}`
            : "بدهی‌ها"
        }
        onClose={() => {
          setSelectedPerson(null);
          setPersonPayables([]);
        }}
      >
        {payablesLoading ? (
          <div className="text-xs text-zinc-500">در حال دریافت...</div>
        ) : personPayables.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-600 border-b">
                  <th className="text-right py-2">ID</th>
                  <th className="text-right py-2">تاریخ</th>
                  <th className="text-right py-2">پروژه</th>
                  <th className="text-left py-2">جمع بدهی</th>
                  <th className="text-left py-2">پرداخت/تخصیص</th>
                  <th className="text-left py-2">مانده</th>
                </tr>
              </thead>
              <tbody>
                {personPayables.map((r, idx) => (
                  <tr
                    key={`${r.debtId ?? r.debt_id ?? idx}`}
                    className="border-b"
                  >
                    <td className="py-2 text-right">{r.debtId ?? r.debt_id}</td>
                    <td className="py-2 text-right">
                      {r.debtDate ?? r.debt_date}
                    </td>
                    <td className="py-2 text-right">
                      {r.projectTitle ?? r.project_title}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(r.totalDebt ?? r.total_debt)}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(r.totalAllocated ?? r.total_allocated)}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(r.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
