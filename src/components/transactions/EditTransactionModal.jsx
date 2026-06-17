import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";

import LookupSelect from "../lookup/LookupSelect";
import { updateTransaction } from "../../api/transactionsApi";
import { searchPersons } from "../../api/personsApi";
import { getProjectLookups } from "../../api/projectsApi";

import QuickAddPersonModal from "../persons/QuickAddPersonModal";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";
import {
  lookupDisplayName,
  lookupMatches,
  sortLookupOptions,
} from "../../utils/lookupOptions";

/* ======================
   Jalali Date Picker (same as Dashboard)
   ====================== */
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";

function normalizePageLike(data) {
  if (Array.isArray(data)) return { content: data, totalPages: 1 };
  if (data?.content) return data;
  return { content: [], totalPages: 0 };
}

function nowLocalDateTimeForInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/* ======================
   Digit normalization (FA/AR -> EN)
   ====================== */
function toLatinDigits(input) {
  const s = String(input ?? "");
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  let out = "";
  for (const ch of s) {
    const iFa = fa.indexOf(ch);
    if (iFa >= 0) {
      out += String(iFa);
      continue;
    }
    const iAr = ar.indexOf(ch);
    if (iAr >= 0) {
      out += String(iAr);
      continue;
    }
    out += ch;
  }
  return out;
}

/* ======================
   ISO <-> Jalali helpers
   ====================== */
function isoToPersianDateObject(iso) {
  if (!iso) return null;
  return new DateObject({
    date: iso,
    format: "YYYY-MM-DD",
    calendar: gregorian,
    locale: persian_fa,
  }).convert(persian);
}

function persianValueToIso(value) {
  if (!value) return "";
  const g = new DateObject(value).convert(gregorian);
  return toLatinDigits(g.format("YYYY-MM-DD"));
}

function setDatePartForDatetime(prevDatetime, isoDate) {
  if (!isoDate) return prevDatetime || "";
  const prev = String(prevDatetime || "");
  const timePart = prev.includes("T") ? prev.split("T")[1] : "00:00";
  const hhmm = (timePart || "00:00").slice(0, 5) || "00:00";
  return `${isoDate}T${hhmm}`;
}

function personDisplayName(p) {
  if (!p) return "-";
  if (p.isLegal) return p.companyName || `#${p.id}`;
  const full = `${p.name || ""} ${p.lastName || ""}`.trim();
  return full || p.companyName || `#${p.id}`;
}

function projectDisplayName(p) {
  return lookupDisplayName(p);
}

const PAYMENT_TYPES = [
  { code: "CSH", label: "نقد" },
  { code: "CHK", label: "چک" },
  { code: "OTH", label: "سایر" },
];

const TRANSACTION_TYPES = [
  { code: "EXP", label: "هزینه" },
  { code: "TRN", label: "تراکنش" },
  { code: "OTH", label: "سایر" },
];

export default function EditTransactionModal({
  open,
  onClose,
  transaction,
  loading,
  onUpdated,
}) {
  const [saving, setSaving] = useState(false);

  const [project, setProject] = useState(null);
  const [fromPerson, setFromPerson] = useState(null);
  const [toPerson, setToPerson] = useState(null);

  const [code, setCode] = useState("");
  const [dateDue, setDateDue] = useState(""); // ISO YYYY-MM-DD
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentType, setPaymentType] = useState("CSH");
  const [transactionType, setTransactionType] = useState("EXP");
  const [dateRegistered, setDateRegistered] = useState(nowLocalDateTimeForInput()); // ISO datetime-local
  const [dsc, setDsc] = useState("");

  const [projectsCache, setProjectsCache] = useState([]);

  const [quickAddPersonOpen, setQuickAddPersonOpen] = useState(false);
  const [personQuickAddTarget, setPersonQuickAddTarget] = useState(null); // "from" | "to"

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const list = await getProjectLookups();
        setProjectsCache(normalizePageLike(list).content || list || []);
      } catch {}
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!transaction) return;

    setProject(
      transaction.project ||
        (transaction.projectId
          ? { id: transaction.projectId, title: `#${transaction.projectId}` }
          : null)
    );

    setFromPerson(
      transaction.fromPerson ||
        (transaction.fromPersonId
          ? { id: transaction.fromPersonId, name: `#${transaction.fromPersonId}`, isLegal: false }
          : null)
    );

    setToPerson(
      transaction.toPerson ||
        (transaction.toPersonId
          ? { id: transaction.toPersonId, name: `#${transaction.toPersonId}`, isLegal: false }
          : null)
    );

    setCode(transaction.code || "");

    // ensure ISO strings (latin digits)
    setDateDue(toLatinDigits(transaction.dateDue || ""));

    setAmountPaid(transaction.amountPaid != null ? String(transaction.amountPaid) : "");
    setPaymentType(transaction.paymentType || "CSH");
    setTransactionType(transaction.transactionType || "EXP");

    const dr = transaction.dateRegistered || "";
    setDateRegistered(dr ? toLatinDigits(dr.substring(0, 16)) : nowLocalDateTimeForInput());

    setDsc(transaction.dsc || "");
  }, [open, transaction]);

  useEffect(() => {
    if (!open || !transaction?.projectId || projectsCache.length === 0) return;

    const found = projectsCache.find(
      (p) => Number(p?.id) === Number(transaction.projectId)
    );
    if (found) setProject(found);
  }, [open, transaction?.projectId, projectsCache]);

  const fetchPersons = useCallback(async ({ q }) => {
    const res = await searchPersons({ q: q || "", page: 0, size: 20 });
    return (res?.content || res || []).slice(0, 20);
  }, []);

  const fetchProjects = useCallback(
    async ({ q }) => {
      const needle = (q || "").trim();
      if (!needle) return projectsCache.slice(0, 30);
      return projectsCache
        .filter((p) => lookupMatches(p, needle))
        .sort(sortLookupOptions)
        .slice(0, 30);
    },
    [projectsCache]
  );

  const errors = useMemo(() => {
    const e = {};
    if (!project?.id) e.project = "پروژه را انتخاب کنید";
    if (!fromPerson?.id) e.fromPerson = "فرستنده را انتخاب کنید";
    if (!toPerson?.id) e.toPerson = "گیرنده را انتخاب کنید";
    if (!code.trim()) e.code = "کد را وارد کنید";
    if (!dateDue) e.dateDue = "تاریخ سررسید را وارد کنید";
    if (!amountPaid || Number(amountPaid) <= 0) e.amountPaid = "مبلغ معتبر وارد کنید";
    if (!dateRegistered) e.dateRegistered = "تاریخ ثبت را وارد کنید";
    return e;
  }, [project, fromPerson, toPerson, code, dateDue, amountPaid, dateRegistered]);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!transaction?.id) return;

    if (Object.keys(errors).length > 0) {
      toast.error("اطلاعات را کامل کنید");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        projectId: project.id,
        fromPersonId: fromPerson.id,
        toPersonId: toPerson.id,
        code: code.trim(),
        // ✅ send latin digits
        dateDue: toLatinDigits(dateDue),
        amountPaid: Number(toLatinDigits(amountPaid)),
        paymentType,
        transactionType,
        dateRegistered: toLatinDigits(dateRegistered),
        dsc: dsc?.trim() || null,
      };

      await updateTransaction(transaction.id, payload);
      toast.success("ویرایش شد");
      onClose?.();
      await onUpdated?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "خطا در ویرایش"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        title="ویرایش تراکنش"
        onClose={() => {
          if (!saving) onClose?.();
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              انصراف
            </Button>
            <Button onClick={handleSubmit} disabled={saving || loading}>
              {saving ? "در حال ذخیره..." : "ذخیره"}
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="text-sm text-zinc-500">در حال بارگذاری...</div>
        ) : !transaction ? (
          <div className="text-sm text-zinc-500">اطلاعاتی برای نمایش وجود ندارد</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <LookupSelect
              label="پروژه"
              value={project}
              onChange={setProject}
              fetchOptions={fetchProjects}
              display={projectDisplayName}
              placeholder="انتخاب پروژه..."
            />
            {errors.project && <div className="text-xs text-red-600">{errors.project}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="flex items-end justify-between">
                  <div className="flex-1">
                    <LookupSelect
                      label="از"
                      value={fromPerson}
                      onChange={setFromPerson}
                      fetchOptions={fetchPersons}
                      display={personDisplayName}
                      placeholder="انتخاب شخص..."
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="ms-2"
                    onClick={() => {
                      setPersonQuickAddTarget("from");
                      setQuickAddPersonOpen(true);
                    }}
                  >
                    افزودن سریع
                  </Button>
                </div>
                {errors.fromPerson && <div className="text-xs text-red-600">{errors.fromPerson}</div>}
              </div>

              <div>
                <div className="flex items-end justify-between">
                  <div className="flex-1">
                    <LookupSelect
                      label="به"
                      value={toPerson}
                      onChange={setToPerson}
                      fetchOptions={fetchPersons}
                      display={personDisplayName}
                      placeholder="انتخاب شخص..."
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="ms-2"
                    onClick={() => {
                      setPersonQuickAddTarget("to");
                      setQuickAddPersonOpen(true);
                    }}
                  >
                    افزودن سریع
                  </Button>
                </div>
                {errors.toPerson && <div className="text-xs text-red-600">{errors.toPerson}</div>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="کد"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={errors.code}
              />
              <Input
                label="مبلغ"
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                error={errors.amountPaid}
              />
            </div>

            {/* ✅ Jalali pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-700">تاریخ سررسید</label>
                <DatePicker
                  value={isoToPersianDateObject(dateDue)}
                  onChange={(val) => setDateDue(persianValueToIso(val))}
                  calendar={persian}
                  locale={persian_fa}
                  format="YYYY/MM/DD"
                  calendarPosition="bottom-right"
                  inputClass="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                  containerClassName="rtl"
                />
                {errors.dateDue && <div className="text-xs text-red-600 mt-1">{errors.dateDue}</div>}
              </div>

              <div>
                <label className="text-sm text-zinc-700">تاریخ ثبت (با ساعت)</label>
                <DatePicker
                  value={isoToPersianDateObject(String(dateRegistered || "").slice(0, 10))}
                  onChange={(val) => {
                    const iso = persianValueToIso(val);
                    setDateRegistered((prev) => setDatePartForDatetime(prev, iso));
                  }}
                  calendar={persian}
                  locale={persian_fa}
                  format="YYYY/MM/DD"
                  calendarPosition="bottom-right"
                  inputClass="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                  containerClassName="rtl"
                />
                <div className="text-[11px] text-zinc-500 mt-1">
                  زمان (HH:mm) از مقدار فعلی حفظ می‌شود.
                </div>
                {errors.dateRegistered && (
                  <div className="text-xs text-red-600 mt-1">{errors.dateRegistered}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="w-full">
                <div className="mb-1 text-sm text-zinc-700">نوع پرداخت</div>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  {PAYMENT_TYPES.map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full">
                <div className="mb-1 text-sm text-zinc-700">نوع تراکنش</div>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                >
                  {TRANSACTION_TYPES.map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-full">
              <div className="mb-1 text-sm text-zinc-700">توضیحات</div>
              <textarea
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                rows={3}
                value={dsc}
                onChange={(e) => setDsc(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>

      <QuickAddPersonModal
        open={quickAddPersonOpen}
        onClose={() => {
          setQuickAddPersonOpen(false);
          setPersonQuickAddTarget(null);
        }}
        onCreated={(createdPerson) => {
          setQuickAddPersonOpen(false);

          if (createdPerson?.id) {
            if (personQuickAddTarget === "from") setFromPerson(createdPerson);
            if (personQuickAddTarget === "to") setToPerson(createdPerson);
          }

          setPersonQuickAddTarget(null);
          toast.success("شخص ثبت شد");
        }}
      />
    </>
  );
}
