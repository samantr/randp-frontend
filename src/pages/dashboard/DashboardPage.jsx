import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";
import {
  getDashboardCashflow,
  getDashboardSummary,
  getLastRefresh,
  getTopPayers,
  getTopReceivers,
  refreshDashboardMart,
  getPersonsSummary,
  getPersonPayables,
} from "../../api/dashboardApi";

function formatNumber(x) {
  try {
    if (x === null || x === undefined) return "۰";
    const n = typeof x === "string" ? Number(x) : x;
    return new Intl.NumberFormat("fa-IR").format(n);
  } catch {
    return String(x ?? "۰");
  }
}

function toNum(x) {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function BarList({ title, rows }) {
  const max = useMemo(() => {
    const m = Math.max(...(rows || []).map((r) => Number(r.amount || 0)), 0);
    return m <= 0 ? 1 : m;
  }, [rows]);

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="font-semibold text-sm mb-3">{title}</div>
      {(rows || []).length === 0 ? (
        <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const v = Number(r.amount || 0);
            const w = Math.max(2, Math.round((v / max) * 100));
            return (
              <div key={r.personId} className="flex items-center gap-3">
                <div className="w-40 text-xs truncate" title={r.displayName}>
                  {r.displayName}
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded bg-zinc-100 overflow-hidden">
                    <div className="h-2 bg-zinc-700" style={{ width: `${w}%` }} />
                  </div>
                </div>
                <div className="w-24 text-xs text-left tabular-nums">
                  {formatNumber(r.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 top-10 mx-auto w-[95%] max-w-4xl bg-white rounded-2xl shadow-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-bold text-sm">{title}</div>
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm rounded-lg border hover:bg-zinc-50"
          >
            بستن
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [from, setFrom] = useState(addDaysISO(todayISO(), -30));
  const [to, setTo] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [kpis, setKpis] = useState(null);
  const [cashflow, setCashflow] = useState([]);
  const [topPayers, setTopPayers] = useState([]);
  const [topReceivers, setTopReceivers] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [personsSummary, setPersonsSummary] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personPayables, setPersonPayables] = useState([]);
  const [payablesLoading, setPayablesLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [k, cf, tp, tr, lr, ps] = await Promise.all([
        getDashboardSummary({ from, to }),
        getDashboardCashflow({ from, to }),
        getTopPayers({ from, to, limit: 10 }),
        getTopReceivers({ from, to, limit: 10 }),
        getLastRefresh(),
        getPersonsSummary({ from, to, limit: 50 }),
      ]);
      setKpis(k);
      setCashflow(cf);
      setTopPayers(tp);
      setTopReceivers(tr);
      setLastRefresh(lr);
      setPersonsSummary(ps || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
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
      toast.error(getApiErrorMessage(e));
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
      toast.error(getApiErrorMessage(e));
    } finally {
      setPayablesLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cashflowMax = useMemo(() => {
    const m = Math.max(...cashflow.map((x) => Number(x.amount || 0)), 0);
    return m <= 0 ? 1 : m;
  }, [cashflow]);

  return (
    <div className="p-4 space-y-4">
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
          <div className="text-lg font-bold mt-1">{formatNumber(kpis?.totalTransactionsAmount)}</div>
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

      {/* Cashflow */}
      <div className="bg-white border rounded-xl p-4">
        <div className="font-semibold text-sm mb-3">روند مبلغ تراکنش‌ها (روزانه)</div>
        {cashflow.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="space-y-2">
            {cashflow.slice(-14).map((x) => {
              const v = Number(x.amount || 0);
              const w = Math.max(2, Math.round((v / cashflowMax) * 100));
              return (
                <div key={x.dateKey} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-zinc-600">{x.date}</div>
                  <div className="flex-1">
                    <div className="h-2 rounded bg-zinc-100 overflow-hidden">
                      <div className="h-2 bg-zinc-700" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                  <div className="w-28 text-xs text-left tabular-nums">
                    {formatNumber(x.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tops */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BarList title="بیشترین پرداخت‌کنندگان" rows={topPayers} />
        <BarList title="بیشترین دریافت‌کنندگان" rows={topReceivers} />
      </div>

      {/* Persons summary */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-sm">وضعیت اشخاص (بستانکار/بدهکار)</div>
          <div className="text-[11px] text-zinc-500">
            مانده = جمع بدهی + جمع پرداختی − جمع دریافتی
          </div>
        </div>

        {personsSummary.length === 0 ? (
          <div className="text-xs text-zinc-500">داده‌ای وجود ندارد</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1050px] w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-600 border-b">
                  <th className="text-right py-2">شخص</th>
                  <th className="text-left py-2">جمع دریافتی</th>
                  <th className="text-left py-2">جمع پرداختی</th>
                  <th className="text-left py-2">بدهی/جمع بدهی</th>
                  <th className="text-left py-2">مانده</th>
                </tr>
              </thead>
              <tbody>
                {personsSummary.map((p) => {
                  const net = toNum(p.totalDebt) + toNum(p.totalPaid) - toNum(p.totalReceived);

                  let status = "تسویه";
                  if (net > 0) status = "بستانکار";
                  else if (net < 0) status = "بدهکار";

                  const color =
                    net > 0 ? "text-emerald-700" : net < 0 ? "text-rose-700" : "text-zinc-700";

                  return (
                    <tr
                      key={p.personId}
                      className="border-b hover:bg-zinc-50 cursor-pointer"
                      onClick={() => openPersonPayables(p)}
                      title="کلیک برای ریز بدهی‌های باز"
                    >
                      <td className="py-2 text-right">{p.displayName}</td>
                      <td className="py-2 text-left tabular-nums">{formatNumber(p.totalReceived)}</td>
                      <td className="py-2 text-left tabular-nums">{formatNumber(p.totalPaid)}</td>
                      <td className="py-2 text-left tabular-nums">{formatNumber(p.totalDebt)}</td>

                      <td className={`py-2 text-left tabular-nums font-bold ${color}`}>
                        {formatNumber(net)}
                        <span className="mr-2 text-xs font-normal text-zinc-500">
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill-down modal */}
      <Modal
        open={!!selectedPerson}
        title={
          selectedPerson
            ? `ریز بدهی‌های باز: ${selectedPerson.displayName}`
            : "ریز بدهی‌های باز"
        }
        onClose={() => setSelectedPerson(null)}
      >
        {payablesLoading ? (
          <div className="text-sm text-zinc-600">در حال دریافت...</div>
        ) : personPayables.length === 0 ? (
          <div className="text-sm text-zinc-600">بدهیِ باز یافت نشد.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1000px] w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-600 border-b">
                  <th className="text-right py-2">کد بدهی</th>
                  <th className="text-right py-2">تاریخ سررسید</th>
                  <th className="text-right py-2">پروژه</th>
                  <th className="text-right py-2">شرح</th>
                  <th className="text-left py-2">جمع</th>
                  <th className="text-left py-2">پرداخت‌شده</th>
                  <th className="text-left py-2">مانده</th>
                </tr>
              </thead>
              <tbody>
                {personPayables.map((r) => (
                  <tr key={r.debtHeaderId} className="border-b">
                    <td className="py-2 text-right tabular-nums">{r.debtHeaderId}</td>
                    <td className="py-2 text-right">{r.dateDue || "-"}</td>
                    <td className="py-2 text-right">
                      {r.projectTitle ? r.projectTitle : r.projectId ?? "-"}
                    </td>
                    <td className="py-2 text-right">{r.dsc || "-"}</td>
                    <td className="py-2 text-left tabular-nums">{formatNumber(r.debtTotal)}</td>
                    <td className="py-2 text-left tabular-nums">{formatNumber(r.allocatedTotal)}</td>
                    <td className="py-2 text-left tabular-nums font-semibold">{formatNumber(r.remaining)}</td>
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
