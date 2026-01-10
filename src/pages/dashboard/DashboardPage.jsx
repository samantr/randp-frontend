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
  getItemCategoriesSummary,
  getItemsByCategory,
  getDebtAgingByPerson,
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
   Colors (high contrast)
   ====================== */
const PIE_COLORS = [
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
  return d.toISOString().slice(0, 10); // yyyy-MM-dd
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 top-10 mx-auto w-[95%] max-w-6xl bg-white rounded-2xl shadow-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-bold text-sm">{title}</div>
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm rounded-lg border hover:bg-zinc-50"
          >
            بستن
          </button>
        </div>
        <div className="p-4 max-h-[78vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function MiniTable({ title, subtitle, children, rightAction }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <div className="font-semibold text-sm">{title}</div>
          {subtitle ? (
            <div className="text-[11px] text-zinc-500 mt-1">{subtitle}</div>
          ) : null}
        </div>
        {rightAction ? <div>{rightAction}</div> : null}
      </div>
      {children}
    </div>
  );
}

function PieCard({ title, rows }) {
  const data = useMemo(
    () =>
      (rows || [])
        .filter((x) => Number(x.amount) > 0)
        .map((x) => ({
          name: x.displayName ?? x.display_name ?? x.name ?? "-",
          value: Number(x.amount ?? 0),
        })),
    [rows]
  );

  return (
    <div className="bg-white border rounded-xl p-4 h-[360px]">
      <div className="font-semibold text-sm mb-3">{title}</div>

      {data.length === 0 ? (
        <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>

            <Tooltip formatter={(v) => formatNumber(v)} />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ fontSize: "11px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ======================
   Extra endpoints (axios direct)
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
  return res.data; // { openDebts: [...], unallocatedExpenses: [...] }
}

async function apiGetRecentActivities({ limit }) {
  const res = await api.get("/api/v1/dashboard/recent-activities", {
    params: { limit },
  });
  return res.data;
}

// Executive KPIs kept ONLY for EXP/TRN totals (visual cards)
async function apiGetExecutiveKpis({ from, to, asOf }) {
  const res = await api.get("/api/v1/dashboard/executive-kpis", {
    params: { from, to, asOf },
  });
  return res.data;
}

function badge(type) {
  const t = String(type || "").toUpperCase();
  if (t === "DEBT")
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (t === "TRANSACTION")
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (t === "ALLOCATION")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-zinc-50 text-zinc-700 border-zinc-200";
}

export default function DashboardPage() {
  const [from, setFrom] = useState(addDaysISO(todayISO(), -365));
  const [to, setTo] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [kpis, setKpis] = useState(null);
  const [topPayers, setTopPayers] = useState([]);
  const [topReceivers, setTopReceivers] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);

  // persons drill
  const [personsSummary, setPersonsSummary] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personPayables, setPersonPayables] = useState([]);
  const [payablesLoading, setPayablesLoading] = useState(false);

  // item categories drill
  const [itemCategoriesSummary, setItemCategoriesSummary] = useState([]);
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

  async function loadAll() {
    setLoading(true);

    const calls = {
      summary: () => getDashboardSummary({ from, to }),
      topPayers: () => getTopPayers({ from, to, limit: 10 }),
      topReceivers: () => getTopReceivers({ from, to, limit: 10 }),
      lastRefresh: () => getLastRefresh(),

      personsSummary: () => getPersonsSummary({ from, to, limit: 50 }),
      itemCategoriesSummary: () =>
        getItemCategoriesSummary({ from, to, limit: 50 }),

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

      const ic = get("itemCategoriesSummary");
      if (ic !== undefined) setItemCategoriesSummary(ic || []);

      const dap = get("debtAgingPersons");
      if (dap !== undefined) setDebtAgingPersons(dap || []);

      const odc = get("openDebtsCoverage");
      if (odc !== undefined) setOpenDebtsCoverage(odc || []);

      const uo = get("unallocatedOverview");
      if (uo !== undefined) {
        setUnallocatedOpenDebts(uo?.openDebts || uo?.open_debts || []);
        setUnallocatedExpenseTxs(
          uo?.unallocatedExpenses || uo?.unallocated_expenses || []
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

  async function openItemCategoryDrill(c) {
    setSelectedItemCategory({
      itemCategoryId: c.itemCategoryId,
      title: c.title,
    });
    setItemsByCategory([]);
    setItemsByCategoryLoading(true);
    try {
      const rows = await getItemsByCategory({
        itemCategoryId: c.itemCategoryId,
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
            {lastRefresh?.finishedAt
              ? `آخرین بروزرسانی: ${lastRefresh.finishedAt}`
              : lastRefresh?.startedAt
              ? `آخرین بروزرسانی: ${lastRefresh.startedAt}`
              : "آخرین بروزرسانی: -"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
            <label className="text-xs text-zinc-600">از</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-xs outline-none"
            />
            <label className="text-xs text-zinc-600">تا</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-xs outline-none"
            />
          </div>

          <button
            onClick={loadAll}
            disabled={loading}
            className="bg-white border rounded-xl px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            {loading ? "در حال دریافت..." : "اعمال"}
          </button>

          <button
            onClick={onRefreshMart}
            disabled={refreshing}
            className="bg-zinc-900 text-white rounded-xl px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-60"
          >
            {refreshing ? "در حال بروزرسانی..." : "رفرش داده‌ها"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">مجموع تراکنش‌ها</div>
          <div className="text-lg font-bold mt-1">
            {formatNumber(kpis?.totalTransactionsAmount)}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">تعداد تراکنش‌ها</div>
          <div className="text-lg font-bold mt-1">
            {formatNumber(kpis?.transactionsCount)}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">جمع بدهی‌ها (اقلام)</div>
          <div className="text-lg font-bold mt-1">
            {formatNumber(kpis?.totalDebtAmount)}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">جمع تخصیص‌ها</div>
          <div className="text-lg font-bold mt-1">
            {formatNumber(kpis?.totalAllocatedAmount)}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">مانده بدهی (تقریبی)</div>
          <div className="text-lg font-bold mt-1">
            {formatNumber(kpis?.outstandingDebtAmount)}
          </div>
        </div>
      </div>

      {/* Executive (simplified) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">جمع هزینه‌ها (EXP)</div>
          <div className="text-lg font-bold mt-1">
            {formatNumber(execKpis?.totalExpenseAmount ?? execKpis?.total_expense_amount)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            برای تخصیص‌ها فقط هزینه‌ها مبنا هستند.
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">جمع تنخواه (TRN)</div>
          <div className="text-lg font-bold mt-1">
            {formatNumber(execKpis?.totalTankhahAmount ?? execKpis?.total_tankhah_amount)}
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

      {/* Item Categories drill */}
      <MiniTable
        title="دسته‌بندی‌های کالا/خدمات (Drill)"
        subtitle="کلیک روی هر دسته برای مشاهده آیتم‌ها"
      >
        {itemCategoriesSummary.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-600 border-b">
                  <th className="text-right py-2">دسته</th>
                  <th className="text-left py-2">جمع بدهی</th>
                  <th className="text-left py-2">پرداخت/تخصیص</th>
                  <th className="text-left py-2">مانده</th>
                </tr>
              </thead>
              <tbody>
                {itemCategoriesSummary.map((c) => (
                  <tr
                    key={c.itemCategoryId}
                    className="border-b hover:bg-zinc-50 cursor-pointer transition"
                    onClick={() => openItemCategoryDrill(c)}
                    title="کلیک برای Drill"
                  >
                    <td className="py-2 text-right">{c.title}</td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(c.amount)}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(c.allocatedAmount)}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(c.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <td className="py-2 text-left font-mono">
                      {formatNumber(p.totalDebt)}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(p.totalPaid)}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(p.totalReceived)}
                    </td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(p.remain)}
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
                  <th className="text-left py-2">تخصیص</th>
                  <th className="text-left py-2">مانده</th>
                  <th className="text-right py-2">پوشش</th>
                </tr>
              </thead>
              <tbody>
                {openDebtsCoverage.map((r) => {
                  const debtId = r.debt_header_id ?? r.debtHeaderId;
                  const debtDate = r.debt_date ?? r.debtDate;
                  const personName = r.person_name ?? r.personName;
                  const projectTitle = r.project_title ?? r.projectTitle;

                  const totalDebt = r.total_debt ?? r.totalDebt;
                  const allocated = r.allocated_amount ?? r.allocatedAmount;
                  const remaining = r.remaining ?? 0;
                  const pct = Number(r.covered_percent ?? r.coveredPercent ?? 0);

                  return (
                    <tr key={debtId} className="border-b hover:bg-zinc-50 transition">
                      <td className="py-2 text-right font-mono">{debtId}</td>
                      <td className="py-2 text-right font-mono">{debtDate}</td>
                      <td className="py-2 text-right">{personName}</td>
                      <td className="py-2 text-right">{projectTitle}</td>
                      <td className="py-2 text-left font-mono">
                        {formatNumber(totalDebt)}
                      </td>
                      <td className="py-2 text-left font-mono">
                        {formatNumber(allocated)}
                      </td>
                      <td className="py-2 text-left font-mono">
                        {formatNumber(remaining)}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-28 h-2 bg-zinc-200 rounded-full overflow-hidden">
                            <div
                              className="h-2 bg-emerald-600"
                              style={{
                                width: `${Math.max(0, Math.min(100, pct))}%`,
                              }}
                            />
                          </div>
                          <div className="text-[11px] font-mono w-12 text-left">
                            {pct.toFixed(0)}%
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </MiniTable>

      {/* Unallocated overview (kept) */}
      <MiniTable
        title="تخصیص‌نیافته‌ها"
        subtitle="بدهی‌های باز + هزینه‌های بدون تخصیص (تنخواه/TRN نمایش داده نمی‌شود)"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Open Debts */}
          <div className="bg-white border rounded-xl p-3">
            <div className="text-sm font-semibold mb-2">بدهی‌های باز</div>

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
                      <th className="text-left py-2">تخصیص</th>
                      <th className="text-left py-2">مانده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unallocatedOpenDebts.map((r, idx) => {
                      const debtId = r.debt_header_id ?? r.debtHeaderId ?? idx;
                      const debtDate = r.debt_date ?? r.debtDate ?? "-";
                      const personName =
                        r.person_name ??
                        r.personName ??
                        r.display_name ??
                        r.displayName ??
                        "-";
                      const projectTitle = r.project_title ?? r.projectTitle ?? "-";
                      const totalDebt = r.total_debt ?? r.totalDebt ?? 0;
                      const allocated = r.allocated_amount ?? r.allocatedAmount ?? 0;
                      const remaining = r.remaining ?? 0;

                      return (
                        <tr key={debtId} className="border-b hover:bg-zinc-50 transition">
                          <td className="py-2 text-right font-mono">{debtId}</td>
                          <td className="py-2 text-right font-mono">{debtDate}</td>
                          <td className="py-2 text-right">{personName}</td>
                          <td className="py-2 text-right">{projectTitle}</td>
                          <td className="py-2 text-left font-mono">{formatNumber(totalDebt)}</td>
                          <td className="py-2 text-left font-mono">{formatNumber(allocated)}</td>
                          <td className="py-2 text-left font-mono">{formatNumber(remaining)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unallocated EXP Transactions */}
          <div className="bg-white border rounded-xl p-3">
            <div className="text-sm font-semibold mb-2">
              هزینه‌های بدون تخصیص (فقط EXP)
            </div>

            {unallocatedExpenseTxs.length === 0 ? (
              <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-[980px] w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-600 border-b">
                      <th className="text-right py-2">ID</th>
                      <th className="text-right py-2">تاریخ</th>
                      <th className="text-right py-2">از</th>
                      <th className="text-right py-2">به</th>
                      <th className="text-right py-2">پروژه</th>
                      <th className="text-left py-2">مبلغ</th>
                      <th className="text-left py-2">تخصیص</th>
                      <th className="text-left py-2">مانده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unallocatedExpenseTxs.map((r, idx) => {
                      const txId = r.transaction_id ?? r.transactionId ?? idx;
                      const txDate = r.tx_date ?? r.txDate ?? "-";
                      const fromName = r.from_person_name ?? r.fromPersonName ?? "-";
                      const toName = r.to_person_name ?? r.toPersonName ?? "-";
                      const projectTitle = r.project_title ?? r.projectTitle ?? "-";
                      const amount = r.amount ?? 0;
                      const allocated = r.allocated_amount ?? r.allocatedAmount ?? 0;
                      const remaining = r.remaining ?? 0;

                      return (
                        <tr key={txId} className="border-b hover:bg-zinc-50 transition">
                          <td className="py-2 text-right font-mono">{txId}</td>
                          <td className="py-2 text-right font-mono">{txDate}</td>
                          <td className="py-2 text-right">{fromName}</td>
                          <td className="py-2 text-right">{toName}</td>
                          <td className="py-2 text-right">{projectTitle}</td>
                          <td className="py-2 text-left font-mono">{formatNumber(amount)}</td>
                          <td className="py-2 text-left font-mono">{formatNumber(allocated)}</td>
                          <td className="py-2 text-left font-mono">{formatNumber(remaining)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </MiniTable>

      {/* Recent Activity Feed (visual) */}
      <MiniTable title="آخرین فعالیت‌ها" subtitle="ثبت بدهی، تراکنش و تخصیص‌ها">
        {recentActivities.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="space-y-2">
            {recentActivities.map((a, idx) => {
              const type = a.activityType ?? a.activity_type;
              const time = a.activityTime ?? a.activity_time;
              const title = a.title ?? "-";
              const amount = a.amount ?? 0;

              return (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 border rounded-xl px-3 py-2 text-sm hover:bg-zinc-50 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${badge(type)}`}
                      >
                        {type}
                      </span>
                      <div className="text-xs text-zinc-500">{time}</div>
                    </div>
                    <div className="font-medium mt-1 truncate">{title}</div>
                  </div>

                  <div className="font-mono whitespace-nowrap">
                    {formatNumber(amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </MiniTable>

      {/* Modals */}
      <Modal
        open={!!selectedPerson}
        title={
          selectedPerson?.displayName
            ? `بدهی‌های قابل پرداخت: ${selectedPerson.displayName}`
            : "بدهی‌های قابل پرداخت"
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
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-600 border-b">
                  <th className="text-right py-2">کد بدهی</th>
                  <th className="text-right py-2">تاریخ</th>
                  <th className="text-right py-2">پروژه</th>
                  <th className="text-left py-2">مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {personPayables.map((r, idx) => (
                  <tr
                    key={`${r.debtHeaderId ?? r.debt_header_id ?? idx}`}
                    className="border-b"
                  >
                    <td className="py-2 text-right">
                      {r.debtHeaderId ?? r.debt_header_id}
                    </td>
                    <td className="py-2 text-right">
                      {r.debtDate ?? r.debt_date}
                    </td>
                    <td className="py-2 text-right">
                      {r.projectTitle ?? r.project_title}
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

      <Modal
        open={!!selectedItemCategory}
        title={
          selectedItemCategory?.title
            ? `آیتم‌های دسته‌بندی: ${selectedItemCategory.title}`
            : "آیتم‌ها"
        }
        onClose={() => {
          setSelectedItemCategory(null);
          setItemsByCategory([]);
        }}
      >
        {itemsByCategoryLoading ? (
          <div className="text-xs text-zinc-500">در حال دریافت...</div>
        ) : itemsByCategory.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
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
                    <td className="py-2 text-left font-mono">
                      {formatNumber(it.amount)}
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
      </Modal>
    </div>
  );
}
