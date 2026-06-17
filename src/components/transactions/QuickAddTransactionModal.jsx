import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";

import LookupSelect from "../lookup/LookupSelect";
import { createTransaction } from "../../api/transactionsApi";
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

// keep time part for datetime field when user picks a date
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

export default function QuickAddTransactionModal({ open, onClose, onCreated }) {
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

  const [quickAddPersonOpen, setQuickAddPersonOpen] = useState(false);
  const [personQuickAddTarget, setPersonQuickAddTarget] = useState(null); // "from" | "to"

  const [projectsCache, setProjectsCache] = useState([]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const list = await getProjectLookups();
        setProjectsCache(normalizePageLike(list).content || list || []);
      } catch {}
    })();
  }, [open]);

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
    if (!dateDue) e.dateDue = "تاریخ سررسید را وارد کنید";
    if (!amountPaid || Number(amountPaid) <= 0) e.amountPaid = "مبلغ معتبر وارد کنید";
    if (!dateRegistered) e.dateRegistered = "تاریخ ثبت را وارد کنید";
    return e;
  }, [project, fromPerson, toPerson, dateDue, amountPaid, dateRegistered]);

  function reset() {
    setProject(null);
    setFromPerson(null);
    setToPerson(null);

    setCode("");
    setDateDue("");
    setAmountPaid("");
    setPaymentType("CSH");
    setTransactionType("EXP");
    setDateRegistered(nowLocalDateTimeForInput());
    setDsc("");

    setQuickAddPersonOpen(false);
    setPersonQuickAddTarget(null);
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  async function handleSubmit(e) {
    e?.preventDefault?.();
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
        code: code.trim() || null,
        // ✅ make sure digits are latin before sending
        dateDue: toLatinDigits(dateDue),
        amountPaid: Number(toLatinDigits(amountPaid)),
        paymentType,
        transactionType,
        dateRegistered: toLatinDigits(dateRegistered),
        dsc: dsc?.trim() || null,
      };

      await createTransaction(payload);
      toast.success("ثبت شد");
      onClose?.();
      await onCreated?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "خطا در ثبت تراکنش"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        title="ثبت تراکنش جدید"
        onClose={() => {
          if (!saving) onClose?.();
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              انصراف
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "در حال ثبت..." : "ثبت"}
            </Button>
          </div>
        }
      >
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
              label="کد (اختیاری)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="خالی بگذارید تا خودکار تولید شود"
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
