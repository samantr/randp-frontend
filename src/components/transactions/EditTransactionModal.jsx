import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";

import LookupSelect from "../lookup/LookupSelect";
import { updateTransaction } from "../../api/transactionsApi";
import { searchPersons } from "../../api/personsApi";
import { getProjects } from "../../api/projectsApi";

// اگر مسیر فایل شما فرق دارد، این import را اصلاح کنید
import QuickAddPersonModal from "../persons/QuickAddPersonModal";

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

function personDisplayName(p) {
  if (!p) return "-";
  if (p.isLegal) return p.companyName || `#${p.id}`;
  const full = `${p.name || ""} ${p.lastName || ""}`.trim();
  return full || p.companyName || `#${p.id}`;
}

function projectDisplayName(p) {
  if (!p) return "-";
  return p.title || `#${p.id}`;
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
  const [dateDue, setDateDue] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentType, setPaymentType] = useState("CSH");
  const [transactionType, setTransactionType] = useState("EXP");
  const [dateRegistered, setDateRegistered] = useState(nowLocalDateTimeForInput());
  const [dsc, setDsc] = useState("");

  const [projectsCache, setProjectsCache] = useState([]);

  // Quick add person modal + target
  const [quickAddPersonOpen, setQuickAddPersonOpen] = useState(false);
  const [personQuickAddTarget, setPersonQuickAddTarget] = useState(null); // "from" | "to"

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const list = await getProjects();
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
    setDateDue(transaction.dateDue || "");
    setAmountPaid(transaction.amountPaid != null ? String(transaction.amountPaid) : "");
    setPaymentType(transaction.paymentType || "CSH");
    setTransactionType(transaction.transactionType || "EXP");

    // اگر از backend با ثانیه بیاید هم ok (datetime-local فقط دقیقه)
    const dr = transaction.dateRegistered || "";
    setDateRegistered(dr ? dr.substring(0, 16) : nowLocalDateTimeForInput());

    setDsc(transaction.dsc || "");
  }, [open, transaction]);

  const fetchPersons = useCallback(async ({ q }) => {
    const res = await searchPersons({ q: q || "", page: 0, size: 20 });
    return (res?.content || res || []).slice(0, 20);
  }, []);

  const fetchProjects = useCallback(
    async ({ q }) => {
      const needle = (q || "").trim();
      if (!needle) return projectsCache.slice(0, 30);
      return projectsCache.filter((p) => (p?.title || "").includes(needle)).slice(0, 30);
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
      toast.error(getApiErrorMessage(e, "اطلاعات را کامل کنید"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        projectId: project.id,
        fromPersonId: fromPerson.id,
        toPersonId: toPerson.id,
        code: code.trim(),
        dateDue,
        amountPaid: Number(amountPaid),
        paymentType,
        transactionType,
        dateRegistered,
        dsc: dsc?.trim() || null,
      };

      await updateTransaction(transaction.id, payload);
      toast.success("ویرایش شد");
      onClose?.();
      await onUpdated?.();
    } catch {
      toast.error(getApiErrorMessage(e, "خطا در ویرایش"));
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
              <Input label="کد" value={code} onChange={(e) => setCode(e.target.value)} error={errors.code} />
              <Input
                label="مبلغ"
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                error={errors.amountPaid}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="تاریخ سررسید"
                type="date"
                value={dateDue}
                onChange={(e) => setDateDue(e.target.value)}
                error={errors.dateDue}
              />
              <Input
                label="تاریخ ثبت (با ساعت)"
                type="datetime-local"
                value={dateRegistered}
                onChange={(e) => setDateRegistered(e.target.value)}
                error={errors.dateRegistered}
              />
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
