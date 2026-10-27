import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  downloadDashboardExcel,
  downloadPersonOperationsExcel,
  getDashboardSummary,
  getFutureChequePayments,
  getItemCategoriesSummary,
  getLastRefresh,
  getPersonPayables,
  getPersonsSummary,
  getProjectsSummary,
  getUnallocatedOverview,
  refreshDashboardMart,
} from "../../api/dashboardApi";

import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "۰";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return new Intl.NumberFormat("fa-IR").format(number);
}

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso, days) {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoToPersianDateObject(iso) {
  if (!iso) return null;

  return new DateObject({
    date: iso,
    format: "YYYY-MM-DD",
    calendar: gregorian,
    locale: persian_fa,
  }).convert(persian);
}

function persianDateObjectToIso(value) {
  if (!value) return null;

  const gregorianDate = new DateObject(value).convert(gregorian);

  const year = String(gregorianDate.year).padStart(4, "0");
  const month = String(gregorianDate.month.number).padStart(2, "0");
  const day = String(gregorianDate.day).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizePersianText(value) {
  return String(value ?? "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa");
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {title ? (
        <div className="mb-3 text-sm font-semibold text-zinc-700">
          {title}
        </div>
      ) : null}

      {children}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <Card>
      <div className="mb-3">
        <div className="text-sm font-semibold text-zinc-800">{title}</div>

        {subtitle ? (
          <div className="mt-1 text-xs text-zinc-500">{subtitle}</div>
        ) : null}
      </div>

      {children}
    </Card>
  );
}

function EmptyState() {
  return <div className="py-3 text-xs text-zinc-500">داده‌ای وجود ندارد</div>;
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl rounded-2xl border bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">{title}</div>

          <button
            type="button"
            className="rounded-lg border px-3 py-1 text-xs hover:bg-zinc-50"
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

export default function DashboardPage() {
  const [from, setFrom] = useState(addDaysISO(todayISO(), -1000));
  const [to, setTo] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [appliedRange, setAppliedRange] = useState(null);

  const [kpis, setKpis] = useState(null);
  const [futureCheques, setFutureCheques] = useState([]);
  const [futureChequesFrom, setFutureChequesFrom] = useState("");
  const [futureChequesError, setFutureChequesError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [personsSummary, setPersonsSummary] = useState([]);
  const [projectsSummary, setProjectsSummary] = useState([]);
  const [categoriesSummary, setCategoriesSummary] = useState([]);

  const [openDebts, setOpenDebts] = useState([]);
  const [openExpenses, setOpenExpenses] = useState([]);

  const [personFilter, setPersonFilter] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personPayables, setPersonPayables] = useState([]);
  const [payablesLoading, setPayablesLoading] = useState(false);
  const [downloadingPersonId, setDownloadingPersonId] = useState(null);

  const fromPersian = useMemo(
    () => isoToPersianDateObject(from),
    [from],
  );

  const toPersian = useMemo(
    () => isoToPersianDateObject(to),
    [to],
  );

  const filteredPersons = useMemo(() => {
    const filter = normalizePersianText(personFilter);

    if (!filter) {
      return personsSummary;
    }

    return personsSummary.filter((person) =>
      normalizePersianText(
        person.displayName ?? person.display_name,
      ).includes(filter),
    );
  }, [personsSummary, personFilter]);

  function openInNewTab(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function loadAll() {
    if (to < from) {
      toast.error("بازه تاریخ نامعتبر است");
      return;
    }

    setLoading(true);
    setFutureChequesError(false);
    const chequeFrom = addDaysISO(todayISO(), 1);
    setFutureChequesFrom(chequeFrom);

    const requests = [
      {
        key: "futureCheques",
        label: "چک‌های سررسید آینده",
        request: getFutureChequePayments({ from: chequeFrom }),
      },
      {
        key: "summary",
        label: "خلاصه داشبورد",
        request: getDashboardSummary({ from, to }),
      },
      {
        key: "lastRefresh",
        label: "آخرین بروزرسانی",
        request: getLastRefresh(),
      },
      {
        key: "persons",
        label: "خلاصه اشخاص",
        request: getPersonsSummary({ from, to, limit: 200 }),
      },
      {
        key: "projects",
        label: "خلاصه پروژه‌ها",
        request: getProjectsSummary({ from, to, limit: 200 }),
      },
      {
        key: "categories",
        label: "خلاصه دسته‌بندی‌ها",
        request: getItemCategoriesSummary({ from, to, limit: 200 }),
      },
      {
        key: "unallocated",
        label: "هزینه‌ها و بدهی‌های باز",
        request: getUnallocatedOverview({ from, to, limit: 50 }),
      },
    ];

    try {
      const results = await Promise.allSettled(
        requests.map((item) => item.request),
      );

      results.forEach((result, index) => {
        const { key, label } = requests[index];

        if (result.status === "rejected") {
          if (key === "futureCheques") {
            setFutureCheques([]);
            setFutureChequesError(true);
          }
          console.error(`[Dashboard] ${key} failed`, result.reason);
          toast.error(
            `${label}: ${getApiErrorMessage(result.reason) || "خطا"}`,
          );
          return;
        }

        const data = result.value;
        if (key === "futureCheques") setFutureCheques(data || []);

        if (key === "summary") {
          setKpis(data);
        }

        if (key === "lastRefresh") {
          setLastRefresh(data);
        }

        if (key === "persons") {
          setPersonsSummary(data || []);
        }

        if (key === "projects") {
          setProjectsSummary(data || []);
        }

        if (key === "categories") {
          setCategoriesSummary(data || []);
        }

        if (key === "unallocated") {
          setOpenDebts(
            data?.openDebts ??
              data?.open_debts ??
              [],
          );

          setOpenExpenses(
            data?.unallocatedExpenses ??
              data?.unallocated_expenses ??
              [],
          );
        }
      });
      setAppliedRange({ from, to });
    } finally {
      setLoading(false);
    }
  }

  async function onExportDashboard() {
    if (!appliedRange || loading || refreshing || exporting) return;
    if (from !== appliedRange.from || to !== appliedRange.to) {
      toast.error("ابتدا بازه تاریخ را اعمال کنید");
      return;
    }

    setExporting(true);
    try {
      await downloadDashboardExcel({
        ...appliedRange,
        chequesFrom: futureChequesFrom,
      });
      toast.success("فایل اکسل داشبورد آماده شد");
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "خطا در ساخت خروجی اکسل داشبورد");
    } finally {
      setExporting(false);
    }
  }

  async function onRefreshMart() {
    setRefreshing(true);

    try {
      const result = await refreshDashboardMart();
      setLastRefresh(result);

      toast.success("به‌روزرسانی انبار داده انجام شد");

      await loadAll();
    } catch (error) {
      toast.error(
        getApiErrorMessage(error) || "خطا در به‌روزرسانی انبار داده",
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function openPersonPayables(person) {
    const personId = person.personId ?? person.person_id;
    const displayName =
      person.displayName ?? person.display_name ?? "شخص";

    setSelectedPerson({ personId, displayName });
    setPersonPayables([]);
    setPayablesLoading(true);

    try {
      const rows = await getPersonPayables({
        personId,
        from,
        to,
        limit: 100,
      });

      setPersonPayables(rows || []);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error) || "خطا در دریافت بدهی‌های شخص",
      );
    } finally {
      setPayablesLoading(false);
    }
  }

  async function onDownloadPersonExcel(event, person) {
    event.stopPropagation();

    const personId = person.personId ?? person.person_id;
    const displayName =
      person.displayName ?? person.display_name ?? "شخص";

    setDownloadingPersonId(personId);

    try {
      await downloadPersonOperationsExcel({
        personId,
        displayName,
        from,
        to,
      });

      toast.success("فایل اکسل ساخته شد");
    } catch (error) {
      toast.error(
        getApiErrorMessage(error) || "خطا در ساخت فایل اکسل",
      );
    } finally {
      setDownloadingPersonId(null);
    }
  }

  useEffect(() => {
    loadAll();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshedAt =
    lastRefresh?.refreshedAt ??
    lastRefresh?.refreshed_at ??
    "-";

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold">داشبورد</div>

          <div className="text-xs text-zinc-500">
            آخرین بروزرسانی: {refreshedAt}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">از</span>

            <DatePicker
              calendar={persian}
              locale={persian_fa}
              value={fromPersian}
              onChange={(value) => {
                const iso = persianDateObjectToIso(value);
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
              onChange={(value) => {
                const iso = persianDateObjectToIso(value);
                if (iso) setTo(iso);
              }}
              inputClass="border rounded-lg px-3 py-2 text-sm w-[150px]"
              containerClassName="rtl"
            />
          </div>

          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
            onClick={loadAll}
            disabled={loading}
          >
            {loading ? "در حال دریافت..." : "اعمال"}
          </button>

          <button
            type="button"
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onExportDashboard}
            disabled={loading || refreshing || exporting || !appliedRange ||
              from !== appliedRange.from || to !== appliedRange.to}
            title={appliedRange && (from !== appliedRange.from || to !== appliedRange.to)
              ? "ابتدا بازه تاریخ را اعمال کنید" : "خروجی اکسل از بخش‌های داشبورد"}
          >
            {exporting ? "در حال ساخت اکسل..." : "خروجی اکسل"}
          </button>

          <button
            type="button"
            className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-50"
            onClick={onRefreshMart}
            disabled={refreshing}
          >
            {refreshing ? "در حال بروزرسانی..." : "بروزرسانی انبار داده"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card title="جمع بدهی‌ها">
          <button
            type="button"
            className="text-2xl font-bold text-blue-600 hover:underline"
            onClick={() => openInNewTab("/debts")}
            title="نمایش بدهی‌ها"
          >
            {formatNumber(
              kpis?.totalDebtAmount ??
                kpis?.total_debt_amount,
            )}
          </button>

          <div className="mt-1 text-xs text-zinc-500">
            بدهی‌های ثبت‌شده در بازه انتخاب‌شده
          </div>
        </Card>

        <Card title="جمع هزینه‌ها">
          <button
            type="button"
            className="text-2xl font-bold text-blue-600 hover:underline"
            onClick={() =>
              openInNewTab(
                `/transactions?transactionType=EXP` +
                  `&from=${from}&to=${to}` +
                  `&cf_transactionType=${encodeURIComponent("هزینه")}`,
              )
            }
            title="نمایش هزینه‌ها"
          >
            {formatNumber(
              kpis?.totalTransactionsAmount ??
                kpis?.total_transactions_amount,
            )}
          </button>

          <div className="mt-1 text-xs text-zinc-500">
            تعداد هزینه‌ها:{" "}
            {formatNumber(
              kpis?.transactionsCount ??
                kpis?.transactions_count,
            )}
          </div>
        </Card>
      </div>

      <Section
        title="چک‌های سررسید آینده"
        subtitle="چک‌های ثبت‌شده از فردا به بعد، به تفکیک سررسید؛ مستقل از بازه تاریخ بالای صفحه"
      >
        {loading ? (
          <div className="py-3 text-sm text-zinc-500">در حال دریافت...</div>
        ) : futureChequesError ? (
          <div role="alert" className="py-3 text-sm text-red-600">
            دریافت اطلاعات چک‌ها ناموفق بود.
            <button type="button" onClick={loadAll} className="mr-3 underline">تلاش دوباره</button>
          </div>
        ) : futureCheques.length === 0 ? (
          <div className="py-3 text-sm text-zinc-500">چکی با سررسید آینده ثبت نشده است.</div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm">
                تعداد چک‌ها: {formatNumber(futureCheques.reduce((sum, row) => sum + Number(row.chequeCount), 0))}
                {" | "}جمع مبلغ: {formatNumber(futureCheques.reduce((sum, row) => sum + Number(row.totalAmount), 0))}
              </span>
              <a className="text-sm font-semibold text-blue-600 hover:underline"
                href={`/transactions?paymentType=CHK&from=${futureChequesFrom}`}
                target="_blank" rel="noopener noreferrer">نمایش همه تراکنش‌های چکی</a>
            </div>
            <div className="max-h-[360px] overflow-auto rounded-xl border">
              <table className="w-full min-w-[550px] text-sm">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr>
                    <th className="px-3 py-3 text-right">سررسید</th>
                    <th className="px-3 py-3 text-right">تعداد چک</th>
                    <th className="px-3 py-3 text-right">جمع مبلغ</th>
                    <th className="px-3 py-3 text-right">تراکنش‌ها</th>
                  </tr>
                </thead>
                <tbody>
                  {futureCheques.map((row) => (
                    <tr key={row.dateDue} className="border-t hover:bg-zinc-50">
                      <td className="px-3 py-3">{isoToPersianDateObject(row.dateDue)?.format("YYYY/MM/DD")}</td>
                      <td className="px-3 py-3">{formatNumber(row.chequeCount)}</td>
                      <td className="px-3 py-3 font-semibold">{formatNumber(row.totalAmount)}</td>
                      <td className="px-3 py-3">
                        <a className="font-semibold text-blue-600 hover:underline"
                          href={`/transactions?paymentType=CHK&from=${row.dateDue}&to=${row.dateDue}`}
                          target="_blank" rel="noopener noreferrer">نمایش تراکنش‌ها</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section
        title="خلاصه اشخاص"
        subtitle="مانده = بدهی پروژه به شخص + هزینه‌های شخص + پرداخت به اشخاص − مبلغ دریافتی شخص"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <input
            type="text"
            value={personFilter}
            onChange={(event) => setPersonFilter(event.target.value)}
            placeholder="فیلتر بر اساس نام شخص..."
            className="w-full rounded-lg border px-3 py-2 text-sm md:w-80"
          />

          <div className="text-xs text-zinc-500">
            {formatNumber(filteredPersons.length)} شخص
          </div>
        </div>

        {filteredPersons.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-h-[440px] overflow-auto rounded-xl border">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50 shadow-sm">
                <tr className="text-xs text-zinc-600">
                  <th className="px-3 py-3 text-right">شخص</th>
                  <th className="px-3 py-3 text-left">
                    بدهی پروژه به شخص
                  </th>
                  <th className="px-3 py-3 text-left">هزینه‌ها</th>
                  <th className="px-3 py-3 text-left">پرداخت به اشخاص</th>
                  <th className="px-3 py-3 text-left">مبلغ دریافتی</th>
                  <th className="px-3 py-3 text-left">مانده</th>
                  <th className="px-3 py-3 text-center">خروجی</th>
                </tr>
              </thead>

              <tbody>
                {filteredPersons.map((person) => {
                  const personId =
                    person.personId ?? person.person_id;

                  const displayName =
                    person.displayName ??
                    person.display_name ??
                    "—";

                  const totalDebt =
                    person.totalDebt ??
                    person.total_debt;

                  const totalExpense =
                    person.totalExpense ??
                    person.total_expense;

                  const totalPersonPayment =
                    person.totalPersonPayment ??
                    person.total_person_payment;

                  const totalReceived =
                    person.totalReceived ??
                    person.total_received;

                  return (
                    <tr
                      key={personId}
                      className="cursor-pointer border-t transition hover:bg-zinc-50"
                      onClick={() => openPersonPayables(person)}
                      title="نمایش بدهی‌های قابل پرداخت شخص"
                    >
                      <td className="px-3 py-3 text-right">
                        {displayName}
                      </td>

                      <td className="px-3 py-3 text-left font-mono">
                        <button
                          type="button"
                          className="font-semibold text-blue-600 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openInNewTab(`/debts?pid=${personId}`);
                          }}
                          title="نمایش بدهی‌های شخص"
                        >
                          {formatNumber(totalDebt)}
                        </button>
                      </td>

                      <td className="px-3 py-3 text-left font-mono">
                        <button
                          type="button"
                          className="font-semibold text-blue-600 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();

                            openInNewTab(
                              `/transactions?fromPid=${personId}` +
                                `&transactionType=EXP` +
                                `&from=${from}&to=${to}` +
                                `&cf_transactionType=${encodeURIComponent("هزینه")}`,
                            );
                          }}
                          title="نمایش هزینه‌های شخص"
                        >
                          {formatNumber(totalExpense)}
                        </button>
                      </td>

                      <td className="px-3 py-3 text-left font-mono">
                        <button
                          type="button"
                          className="font-semibold text-blue-600 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();

                            openInNewTab(
                              `/transactions?fromPid=${personId}` +
                                `&transactionType=TRN` +
                                `&from=${from}&to=${to}` +
                                `&cf_transactionType=${encodeURIComponent(
                                  "تراکنش",
                                )}`,
                            );
                          }}
                          title="نمایش پرداخت‌های این شخص به اشخاص دیگر"
                        >
                          {formatNumber(totalPersonPayment)}
                        </button>
                      </td>

                      <td className="px-3 py-3 text-left font-mono">
                        <button
                          type="button"
                          className="font-semibold text-blue-600 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openInNewTab(
                              `/transactions?toPid=${personId}` +
                                `&from=${from}&to=${to}`,
                            );
                          }}
                          title="نمایش مبالغ دریافتی شخص"
                        >
                          {formatNumber(totalReceived)}
                        </button>
                      </td>

                      <td className="px-3 py-3 text-left font-mono font-semibold">
                        {formatNumber(person.remain)}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          className="rounded-lg border border-emerald-600 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          onClick={(event) =>
                            onDownloadPersonExcel(event, person)
                          }
                          disabled={downloadingPersonId === personId}
                        >
                          {downloadingPersonId === personId
                            ? "در حال ساخت..."
                            : "Excel"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section
  title="خلاصه هزینه‌های پروژه"
  subtitle="هزینه‌ها بر اساس پروژه‌های برگ و با مسیر کامل نمایش داده می‌شوند"
>
  {projectsSummary.length === 0 ? (
    <EmptyState />
  ) : (
    <div className="max-h-[400px] overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-50">
          <tr className="text-xs text-zinc-600">
            <th className="px-3 py-3 text-right">مسیر پروژه</th>
            <th className="px-3 py-3 text-left">جمع هزینه</th>
            <th className="px-3 py-3 text-left">جمع بدهی</th>
          </tr>
        </thead>

        <tbody>
          {projectsSummary.map((project) => {
            const projectId =
              project.projectId ?? project.project_id;

            const projectTitle =
              project.projectTitle ??
              project.project_title ??
              "—";

            const totalExpense =
              project.totalExpense ??
              project.total_expense;

            const totalDebt =
              project.totalDebt ??
              project.total_debt;

            return (
              <tr key={projectId} className="border-t">
                <td className="px-3 py-3 text-right">
                  {projectTitle}
                </td>

                <td className="px-3 py-3 text-left font-mono">
                  <button
                    type="button"
                    className="font-semibold text-blue-600 hover:underline"
                    onClick={() =>
                      openInNewTab(
                        `/transactions?projectId=${projectId}` +
                          `&transactionType=EXP` +
                          `&from=${from}&to=${to}` +
                          `&cf_transactionType=${encodeURIComponent(
                            "هزینه",
                          )}`,
                      )
                    }
                    title="نمایش هزینه‌های این پروژه"
                  >
                    {formatNumber(totalExpense)}
                  </button>
                </td>

                <td className="px-3 py-3 text-left font-mono">
                  <button
                    type="button"
                    className="font-semibold text-blue-600 hover:underline"
                    onClick={() =>
                      openInNewTab(`/debts?projectId=${projectId}`)
                    }
                    title="نمایش بدهی‌های این پروژه"
                  >
                    {formatNumber(totalDebt)}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )}
</Section>

<Section
  title="خلاصه هزینه‌های دسته‌بندی"
  subtitle="هزینه‌ها بر اساس دسته‌بندی‌های برگ و با مسیر کامل نمایش داده می‌شوند"
>
  {categoriesSummary.length === 0 ? (
    <EmptyState />
  ) : (
    <div className="max-h-[400px] overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-50">
          <tr className="text-xs text-zinc-600">
            <th className="px-3 py-3 text-right">
              مسیر دسته‌بندی
            </th>
            <th className="px-3 py-3 text-left">
              جمع هزینه
            </th>
          </tr>
        </thead>

        <tbody>
          {categoriesSummary.map((category) => {
            const categoryId =
              category.itemCategoryId ??
              category.item_category_id;

            const categoryTitle =
              category.title ?? "—";

            const totalExpense =
              category.totalExpense ??
              category.total_expense;

            return (
              <tr key={categoryId} className="border-t">
                <td className="px-3 py-3 text-right">
                  {categoryTitle}
                </td>

                <td className="px-3 py-3 text-left font-mono">
                  <button
                    type="button"
                    className="font-semibold text-blue-600 hover:underline"
                    onClick={() =>
                      openInNewTab(
                        `/transactions?categoryId=${categoryId}` +
                          `&transactionType=EXP` +
                          `&from=${from}&to=${to}` +
                          `&cf_transactionType=${encodeURIComponent(
                            "هزینه",
                          )}`,
                      )
                    }
                    title="نمایش هزینه‌های این دسته‌بندی"
                  >
                    {formatNumber(totalExpense)}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )}
</Section>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section
          title="هزینه‌های باز"
          subtitle="هزینه‌هایی که هنوز به‌طور کامل تخصیص داده نشده‌اند"
        >
          {openExpenses.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="max-h-[430px] overflow-auto rounded-xl border">
              <table className="min-w-[850px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-50">
                  <tr className="text-xs text-zinc-600">
                    <th className="px-3 py-3 text-right">شناسه</th>
                    <th className="px-3 py-3 text-right">تاریخ</th>
                    <th className="px-3 py-3 text-right">از شخص</th>
                    <th className="px-3 py-3 text-right">به شخص</th>
                    <th className="px-3 py-3 text-left">مبلغ</th>
                    <th className="px-3 py-3 text-left">تخصیص</th>
                    <th className="px-3 py-3 text-left">مانده</th>
                  </tr>
                </thead>

                <tbody>
                  {openExpenses.map((expense) => {
                    const transactionId =
                      expense.transactionId ??
                      expense.transaction_id;

                    return (
                      <tr key={transactionId} className="border-t">
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            className="font-semibold text-blue-600 hover:underline"
                            onClick={() =>
                              openInNewTab(
                                `/transactions/${transactionId}/allocations`,
                              )
                            }
                            title="نمایش و تخصیص هزینه"
                          >
                            {transactionId}
                          </button>
                        </td>

                        <td className="px-3 py-3 text-right">
                          {expense.txDate ??
                            expense.tx_date ??
                            "—"}
                        </td>

                        <td className="px-3 py-3 text-right">
                          {expense.fromPersonName ??
                            expense.from_person_name ??
                            "—"}
                        </td>

                        <td className="px-3 py-3 text-right">
                          {expense.toPersonName ??
                            expense.to_person_name ??
                            "—"}
                        </td>

                        <td className="px-3 py-3 text-left font-mono">
                          {formatNumber(expense.amount)}
                        </td>

                        <td className="px-3 py-3 text-left font-mono">
                          {formatNumber(
                            expense.allocatedAmount ??
                              expense.allocated_amount,
                          )}
                        </td>

                        <td className="px-3 py-3 text-left font-mono font-semibold">
                          {formatNumber(expense.remaining)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title="بدهی‌های باز"
          subtitle="بدهی‌هایی که هنوز به‌طور کامل پوشش داده نشده‌اند"
        >
          {openDebts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="max-h-[430px] overflow-auto rounded-xl border">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-50">
                  <tr className="text-xs text-zinc-600">
                    <th className="px-3 py-3 text-right">شناسه</th>
                    <th className="px-3 py-3 text-right">تاریخ</th>
                    <th className="px-3 py-3 text-right">شخص</th>
                    <th className="px-3 py-3 text-right">پروژه</th>
                    <th className="px-3 py-3 text-left">بدهی</th>
                    <th className="px-3 py-3 text-left">پوشش</th>
                    <th className="px-3 py-3 text-left">مانده</th>
                  </tr>
                </thead>

                <tbody>
                  {openDebts.map((debt) => {
                    const debtId =
                      debt.debtHeaderId ??
                      debt.debt_header_id;

                    return (
                      <tr key={debtId} className="border-t">
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            className="font-semibold text-blue-600 hover:underline"
                            onClick={() =>
                              openInNewTab(`/debts?sid=${debtId}`)
                            }
                            title="نمایش بدهی"
                          >
                            {debtId}
                          </button>
                        </td>

                        <td className="px-3 py-3 text-right">
                          {debt.debtDate ??
                            debt.debt_date ??
                            "—"}
                        </td>

                        <td className="px-3 py-3 text-right">
                          {debt.personName ??
                            debt.person_name ??
                            "—"}
                        </td>

                        <td className="px-3 py-3 text-right">
                          {debt.projectTitle ??
                            debt.project_title ??
                            "—"}
                        </td>

                        <td className="px-3 py-3 text-left font-mono">
                          {formatNumber(
                            debt.totalDebt ??
                              debt.total_debt,
                          )}
                        </td>

                        <td className="px-3 py-3 text-left font-mono">
                          {formatNumber(
                            debt.allocatedAmount ??
                              debt.allocated_amount,
                          )}
                        </td>

                        <td className="px-3 py-3 text-left font-mono font-semibold">
                          {formatNumber(debt.remaining)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

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
          <EmptyState />
        ) : (
          <div className="max-h-[500px] overflow-auto rounded-xl border">
            <table className="min-w-[850px] w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="text-xs text-zinc-600">
                  <th className="px-3 py-3 text-right">شناسه</th>
                  <th className="px-3 py-3 text-right">تاریخ</th>
                  <th className="px-3 py-3 text-right">پروژه</th>
                  <th className="px-3 py-3 text-left">بدهی</th>
                  <th className="px-3 py-3 text-left">تخصیص</th>
                  <th className="px-3 py-3 text-left">مانده</th>
                </tr>
              </thead>

              <tbody>
                {personPayables.map((debt) => {
                  const debtId =
                    debt.debtHeaderId ??
                    debt.debt_header_id ??
                    debt.debtId ??
                    debt.debt_id;

                  return (
                    <tr key={debtId} className="border-t">
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          className="font-semibold text-blue-600 hover:underline"
                          onClick={() =>
                            openInNewTab(`/debts?sid=${debtId}`)
                          }
                        >
                          {debtId}
                        </button>
                      </td>

                      <td className="px-3 py-3 text-right">
                        {debt.debtDate ??
                          debt.debt_date ??
                          "—"}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {debt.projectTitle ??
                          debt.project_title ??
                          "—"}
                      </td>

                      <td className="px-3 py-3 text-left font-mono">
                        {formatNumber(
                          debt.totalDebt ??
                            debt.total_debt,
                        )}
                      </td>

                      <td className="px-3 py-3 text-left font-mono">
                        {formatNumber(
                          debt.allocatedAmount ??
                            debt.allocated_amount,
                        )}
                      </td>

                      <td className="px-3 py-3 text-left font-mono font-semibold">
                        {formatNumber(debt.remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
