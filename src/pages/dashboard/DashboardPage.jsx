import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

// ✅ use working ones from dashboardApi (axios-based)
import {
  getDashboardCashflow,
  getDashboardSummary,
  getLastRefresh,
  getTopPayers,
  getTopReceivers,
  refreshDashboardMart,
  getPersonsSummary,
  getPersonPayables,
  getItemCategoriesSummary,
  getItemsByCategory,
} from "../../api/dashboardApi";

// ✅ bypass broken apiGet() inside dashboardApi.js for project drill endpoints
import api from "../../api/axios";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
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

/* ======================
   Project Drill API (bypass apiGet bug)
   ====================== */
async function apiGetProjectsRoot({ from, to, limit }) {
  const res = await api.get("/api/v1/dashboard/projects-summary", {
    params: { from, to, limit },
  });
  return res.data;
}
async function apiGetProjectChildren({ projectId, from, to, limit }) {
  const res = await api.get(`/api/v1/dashboard/projects/${projectId}/children`, {
    params: { from, to, limit },
  });
  return res.data;
}
async function apiGetProjectCategories({ projectId, from, to, limit }) {
  const res = await api.get(`/api/v1/dashboard/projects/${projectId}/categories`, {
    params: { from, to, limit },
  });
  return res.data;
}
async function apiGetProjectItems({ projectId, itemCategoryId, from, to, limit }) {
  const params = { from, to, limit };
  if (itemCategoryId) params.itemCategoryId = itemCategoryId;
  const res = await api.get(`/api/v1/dashboard/projects/${projectId}/items`, { params });
  return res.data;
}

export default function DashboardPage() {
  const [from, setFrom] = useState(addDaysISO(todayISO(), -365));
  const [to, setTo] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [kpis, setKpis] = useState(null);
  const [cashflow, setCashflow] = useState([]);
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

  // ✅ Projects drill (root → children → categories → items)
  const [projectsRoot, setProjectsRoot] = useState([]);
  const [projStack, setProjStack] = useState([]); // [{projectId, projectTitle}]
  const [projMode, setProjMode] = useState("root"); // root | children | categories | items
  const [projRows, setProjRows] = useState([]); // used in children mode
  const [projCategories, setProjCategories] = useState([]);
  const [projItems, setProjItems] = useState([]);
  const [projSelectedCategory, setProjSelectedCategory] = useState(null);
  const [projLoading, setProjLoading] = useState(false);

  const projCurrent = useMemo(
    () => (projStack.length ? projStack[projStack.length - 1] : null),
    [projStack]
  );

  const cashflowLineData = useMemo(() => {
    return (cashflow || []).map((x) => ({
      date: x.date ?? x.day ?? x.label,
      amount: Number(x.amount || 0),
    }));
  }, [cashflow]);

  function projBreadcrumb() {
    if (!projStack.length) return "پروژه‌ها (ریشه)";
    return projStack.map((x) => x.projectTitle).join(" ← ");
  }

  async function loadAll() {
    setLoading(true);

    const calls = {
      summary: () => getDashboardSummary({ from, to }),
      cashflow: () => getDashboardCashflow({ from, to }),
      topPayers: () => getTopPayers({ from, to, limit: 10 }),
      topReceivers: () => getTopReceivers({ from, to, limit: 10 }),
      lastRefresh: () => getLastRefresh(),
      personsSummary: () => getPersonsSummary({ from, to, limit: 50 }),
      itemCategoriesSummary: () => getItemCategoriesSummary({ from, to, limit: 50 }),

      // ✅ projects root (bypass dashboardApi bug)
      projectsRoot: () => apiGetProjectsRoot({ from, to, limit: 50 }),
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

      const cf = get("cashflow");
      if (cf !== undefined) setCashflow(cf || []);

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

      const pr = get("projectsRoot");
      if (pr !== undefined) setProjectsRoot(pr || []);

      // reset project drill state on load
      setProjStack([]);
      setProjMode("root");
      setProjRows([]);
      setProjCategories([]);
      setProjItems([]);
      setProjSelectedCategory(null);

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
    setSelectedItemCategory({ itemCategoryId: c.itemCategoryId, title: c.title });
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

  /* ======================
     Projects drill handlers
     ====================== */
  async function openProjectRootNode(p) {
    const projectId = p.projectId;
    const projectTitle = p.projectTitle || `پروژه ${projectId}`;

    setProjLoading(true);
    setProjSelectedCategory(null);
    setProjCategories([]);
    setProjItems([]);
    try {
      // push
      setProjStack((prev) => [...prev, { projectId, projectTitle }]);

      // first try children
      const children = await apiGetProjectChildren({
        projectId,
        from,
        to,
        limit: 200,
      });

      if (children?.length) {
        setProjMode("children");
        setProjRows(children);
        return;
      }

      // if no children -> categories
      const cats = await apiGetProjectCategories({
        projectId,
        from,
        to,
        limit: 200,
      });
      setProjMode("categories");
      setProjCategories(cats || []);
      setProjRows([]);
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "خطا");
    } finally {
      setProjLoading(false);
    }
  }

  async function openChildProject(p) {
    const projectId = p.projectId;
    const projectTitle = p.projectTitle || `پروژه ${projectId}`;

    setProjLoading(true);
    setProjSelectedCategory(null);
    setProjCategories([]);
    setProjItems([]);
    try {
      setProjStack((prev) => [...prev, { projectId, projectTitle }]);

      const children = await apiGetProjectChildren({
        projectId,
        from,
        to,
        limit: 200,
      });

      if (children?.length) {
        setProjMode("children");
        setProjRows(children);
        return;
      }

      const cats = await apiGetProjectCategories({
        projectId,
        from,
        to,
        limit: 200,
      });
      setProjMode("categories");
      setProjCategories(cats || []);
      setProjRows([]);
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "خطا");
    } finally {
      setProjLoading(false);
    }
  }

  async function openProjectCategory(cat) {
    if (!projCurrent) return;
    const projectId = projCurrent.projectId;

    setProjLoading(true);
    setProjSelectedCategory({ itemCategoryId: cat.itemCategoryId, title: cat.title });
    setProjItems([]);

    try {
      const items = await apiGetProjectItems({
        projectId,
        itemCategoryId: cat.itemCategoryId,
        from,
        to,
        limit: 300,
      });
      setProjMode("items");
      setProjItems(items || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "خطا");
    } finally {
      setProjLoading(false);
    }
  }

  async function openAllProjectItems() {
    if (!projCurrent) return;
    const projectId = projCurrent.projectId;

    setProjLoading(true);
    setProjSelectedCategory(null);
    setProjItems([]);

    try {
      const items = await apiGetProjectItems({
        projectId,
        itemCategoryId: null,
        from,
        to,
        limit: 300,
      });
      setProjMode("items");
      setProjItems(items || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "خطا");
    } finally {
      setProjLoading(false);
    }
  }

  async function projBack() {
    // items -> categories
    if (projMode === "items") {
      setProjMode("categories");
      setProjItems([]);
      setProjSelectedCategory(null);
      return;
    }

    // categories/children -> pop stack and show parent's children (or root)
    if (projMode === "categories" || projMode === "children") {
      const next = projStack.slice(0, -1);
      setProjStack(next);

      setProjSelectedCategory(null);
      setProjCategories([]);
      setProjItems([]);
      setProjRows([]);

      if (!next.length) {
        setProjMode("root");
        return;
      }

      // load parent's children; if none => categories
      const parent = next[next.length - 1];
      setProjLoading(true);
      try {
        const children = await apiGetProjectChildren({
          projectId: parent.projectId,
          from,
          to,
          limit: 200,
        });

        if (children?.length) {
          setProjMode("children");
          setProjRows(children);
        } else {
          const cats = await apiGetProjectCategories({
            projectId: parent.projectId,
            from,
            to,
            limit: 200,
          });
          setProjMode("categories");
          setProjCategories(cats || []);
        }
      } catch (e) {
        toast.error(getApiErrorMessage(e) || "خطا");
      } finally {
        setProjLoading(false);
      }
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ======================
     UI (tables)
     ====================== */
  const ProjectTable = ({ rows, onClickRow }) => {
    if (!rows?.length) return <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>;
    return (
      <div className="overflow-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-600 border-b">
              <th className="text-right py-2">پروژه</th>
              <th className="text-left py-2">جمع بدهی</th>
              <th className="text-left py-2">پرداخت/تخصیص</th>
              <th className="text-left py-2">مانده</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.projectId}
                className="border-b hover:bg-zinc-50 cursor-pointer"
                onClick={() => onClickRow(p)}
                title="کلیک برای Drill"
              >
                <td className="py-2 text-right">{p.projectTitle || `پروژه ${p.projectId}`}</td>
                <td className="py-2 text-left font-mono">{formatNumber(p.totalDebt)}</td>
                <td className="py-2 text-left font-mono">{formatNumber(p.totalAllocated)}</td>
                <td className="py-2 text-left font-mono">{formatNumber(p.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const CategoryTable = ({ rows, onClickRow }) => {
    if (!rows?.length) return <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>;
    return (
      <div className="overflow-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-600 border-b">
              <th className="text-right py-2">دسته‌بندی</th>
              <th className="text-left py-2">جمع بدهی</th>
              <th className="text-left py-2">پرداخت/تخصیص</th>
              <th className="text-left py-2">مانده</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.itemCategoryId}
                className="border-b hover:bg-zinc-50 cursor-pointer"
                onClick={() => onClickRow(c)}
                title="کلیک برای مشاهده آیتم‌ها"
              >
                <td className="py-2 text-right">{c.title}</td>
                <td className="py-2 text-left font-mono">{formatNumber(c.amount)}</td>
                <td className="py-2 text-left font-mono">{formatNumber(c.allocatedAmount)}</td>
                <td className="py-2 text-left font-mono">{formatNumber(c.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const ItemsTable = ({ rows }) => {
    if (!rows?.length) return <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>;
    return (
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
            {rows.map((it, idx) => (
              <tr key={`${it.itemId ?? it.item_id ?? idx}`} className="border-b">
                <td className="py-2 text-right">{it.title}</td>
                <td className="py-2 text-left font-mono">{formatNumber(it.amount)}</td>
                <td className="py-2 text-left font-mono">{formatNumber(it.allocatedAmount)}</td>
                <td className="py-2 text-left font-mono">{formatNumber(it.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

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
          <div className="text-lg font-bold mt-1">{formatNumber(kpis?.transactionsCount)}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">جمع بدهی‌ها (اقلام)</div>
          <div className="text-lg font-bold mt-1">{formatNumber(kpis?.totalDebtAmount)}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">جمع تخصیص‌ها</div>
          <div className="text-lg font-bold mt-1">{formatNumber(kpis?.totalAllocatedAmount)}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-zinc-500">مانده بدهی (تقریبی)</div>
          <div className="text-lg font-bold mt-1">{formatNumber(kpis?.outstandingDebtAmount)}</div>
        </div>
      </div>

      {/* Cashflow Line Chart */}
      <div className="bg-white border rounded-xl p-4 h-[360px]">
        <div className="font-semibold text-sm mb-3">روند مبلغ تراکنش‌ها (روزانه)</div>

        {cashflowLineData.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cashflowLineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip
                formatter={(v) => formatNumber(v)}
                labelFormatter={(l) => `تاریخ: ${l}`}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PieCard title="بیشترین پرداخت‌کنندگان" rows={topPayers} />
        <PieCard title="بیشترین دریافت‌کنندگان" rows={topReceivers} />
      </div>

      {/* Drills */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-3">
        {/* Projects drill */}
        <MiniTable
          title={`پروژه‌ها (Drill)`}
          subtitle={
            projMode === "root"
              ? "فقط پروژه‌های ریشه نمایش داده می‌شوند. برای Drill کلیک کنید."
              : projBreadcrumb()
          }
          rightAction={
            projMode !== "root" ? (
              <button
                onClick={projBack}
                disabled={projLoading}
                className="bg-white border rounded-xl px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-60"
              >
                بازگشت
              </button>
            ) : null
          }
        >
          {projLoading ? (
            <div className="text-xs text-zinc-500">در حال بارگذاری...</div>
          ) : projMode === "root" ? (
            <ProjectTable rows={projectsRoot} onClickRow={openProjectRootNode} />
          ) : projMode === "children" ? (
            <ProjectTable rows={projRows} onClickRow={openChildProject} />
          ) : projMode === "categories" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-zinc-600">
                  {projCurrent ? `پروژه: ${projCurrent.projectTitle}` : ""}
                </div>
                <button
                  onClick={openAllProjectItems}
                  disabled={projLoading}
                  className="bg-zinc-900 text-white rounded-xl px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-60"
                >
                  نمایش همه آیتم‌ها
                </button>
              </div>
              <CategoryTable rows={projCategories} onClickRow={openProjectCategory} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-zinc-600">
                  {projCurrent ? `پروژه: ${projCurrent.projectTitle}` : ""}
                  {projSelectedCategory?.title ? ` | دسته: ${projSelectedCategory.title}` : ""}
                </div>
                <div className="flex items-center gap-2">
                  {projSelectedCategory ? (
                    <button
                      onClick={openAllProjectItems}
                      className="bg-white border rounded-xl px-3 py-1.5 text-xs hover:bg-zinc-50"
                    >
                      حذف فیلتر دسته
                    </button>
                  ) : null}
                  <button
                    onClick={() => setProjMode("categories")}
                    className="bg-white border rounded-xl px-3 py-1.5 text-xs hover:bg-zinc-50"
                  >
                    بازگشت به دسته‌ها
                  </button>
                </div>
              </div>
              <ItemsTable rows={projItems} />
            </div>
          )}
        </MiniTable>

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
                      className="border-b hover:bg-zinc-50 cursor-pointer"
                      onClick={() => openItemCategoryDrill(c)}
                      title="کلیک برای Drill"
                    >
                      <td className="py-2 text-right">{c.title}</td>
                      <td className="py-2 text-left font-mono">{formatNumber(c.amount)}</td>
                      <td className="py-2 text-left font-mono">
                        {formatNumber(c.allocatedAmount)}
                      </td>
                      <td className="py-2 text-left font-mono">{formatNumber(c.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MiniTable>
      </div>

      {/* Persons drill (keep) */}
      <MiniTable title="اشخاص" subtitle="کلیک روی شخص برای دیدن بدهی‌های قابل پرداخت">
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
                    className="border-b hover:bg-zinc-50 cursor-pointer"
                    onClick={() => openPersonPayables(p)}
                    title="کلیک برای Drill"
                  >
                    <td className="py-2 text-right">{p.displayName}</td>
                    <td className="py-2 text-left font-mono">{formatNumber(p.totalDebt)}</td>
                    <td className="py-2 text-left font-mono">{formatNumber(p.totalPaid)}</td>
                    <td className="py-2 text-left font-mono">{formatNumber(p.totalReceived)}</td>
                    <td className="py-2 text-left font-mono">{formatNumber(p.remain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <tr key={`${r.debtHeaderId ?? r.debt_header_id ?? idx}`} className="border-b">
                    <td className="py-2 text-right">{r.debtHeaderId ?? r.debt_header_id}</td>
                    <td className="py-2 text-right">{r.debtDate ?? r.debt_date}</td>
                    <td className="py-2 text-right">{r.projectTitle ?? r.project_title}</td>
                    <td className="py-2 text-left font-mono">{formatNumber(r.remaining)}</td>
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
                  <tr key={`${it.itemId ?? it.item_id ?? idx}`} className="border-b">
                    <td className="py-2 text-right">{it.title}</td>
                    <td className="py-2 text-left font-mono">{formatNumber(it.amount)}</td>
                    <td className="py-2 text-left font-mono">
                      {formatNumber(it.allocatedAmount)}
                    </td>
                    <td className="py-2 text-left font-mono">{formatNumber(it.remaining)}</td>
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
