import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";
import { FileText, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";

import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";
import DataTable from "../table/DataTable";
import Pagination from "../table/Pagination";
import Input from "../common/Input";
import {
  deleteDocumentArchive,
  listDocumentArchives,
} from "../../api/documentArchivesApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const PAGE_SIZE = 20;

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

function isoToJalaliText(iso) {
  if (!iso) return "-";
  try {
    return isoToPersianDateObject(String(iso).slice(0, 10))?.format("YYYY/MM/DD") || "-";
  } catch {
    return String(iso).slice(0, 10);
  }
}

function emptyFilters() {
  return {
    code: "",
    description: "",
    from: "",
    to: "",
  };
}

export default function DocumentArchivesListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(
    async ({ nextPage = page, nextFilters = appliedFilters } = {}) => {
      setLoading(true);
      try {
        const res = await listDocumentArchives({
          page: nextPage,
          size: PAGE_SIZE,
          ...nextFilters,
        });
        setData(res || { content: [], totalPages: 0 });
      } catch (e) {
        toast.error(getApiErrorMessage(e, "خطا در دریافت فهرست بایگانی اسناد"));
        setData({ content: [], totalPages: 0 });
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, page],
  );

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function applyFilters() {
    setPage(0);
    setAppliedFilters(filters);
    await load({ nextPage: 0, nextFilters: filters });
  }

  async function clearFilters() {
    const cleared = emptyFilters();
    setFilters(cleared);
    setAppliedFilters(cleared);
    setPage(0);
    await load({ nextPage: 0, nextFilters: cleared });
  }

  async function refresh() {
    await load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocumentArchive(deleteTarget.id);
      toast.success("بایگانی حذف شد");
      setDeleteTarget(null);

      const isLastRowOnPage = (data?.content || []).length <= 1;
      const nextPage = isLastRowOnPage && page > 0 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      await load({ nextPage });
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در حذف بایگانی"));
    } finally {
      setDeleting(false);
    }
  }

  const rows = useMemo(
    () =>
      (data.content || []).map((row, index) => ({
        ...row,
        _key: row.id,
        rowNumber: page * PAGE_SIZE + index + 1,
      })),
    [data.content, page],
  );

  const columns = useMemo(
    () => [
      { key: "rowNumber", title: "ردیف", render: (r) => r.rowNumber },
      {
        key: "code",
        title: "کد بایگانی",
        render: (r) => <span className="font-semibold">{r.code || "-"}</span>,
      },
      {
        key: "description",
        title: "شرح",
        render: (r) => (
          <span className="block max-w-[360px] truncate" title={r.description || ""}>
            {r.description || "-"}
          </span>
        ),
      },
      { key: "archiveDate", title: "تاریخ", render: (r) => isoToJalaliText(r.archiveDate) },
      {
        key: "documentCount",
        title: "تعداد اسناد",
        render: (r) => Number(r.documentCount || 0).toLocaleString("fa-IR"),
      },
      {
        key: "actions",
        title: "عملیات",
        render: (r) => (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/document-archives/${r.id}`)}>
              <Pencil size={16} />
              ویرایش
            </Button>
            <Button variant="danger" onClick={() => setDeleteTarget(r)} disabled={deleting}>
              <Trash2 size={16} />
              حذف
            </Button>
          </div>
        ),
      },
    ],
    [deleting, navigate],
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xl font-bold">
            <FileText size={22} />
            بایگانی اسناد
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            فهرست بایگانی‌ها و تعداد اسناد ثبت‌شده
          </div>
        </div>
        <Button onClick={() => navigate("/document-archives/new")}>
          <Plus size={16} />
          ایجاد بایگانی جدید
        </Button>
      </div>

      <div className="rounded-2xl border bg-white p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            label="کد"
            value={filters.code}
            onChange={(e) => updateFilter("code", e.target.value)}
            placeholder="ARC-000001"
          />
          <Input
            label="شرح"
            value={filters.description}
            onChange={(e) => updateFilter("description", e.target.value)}
            placeholder="جستجو در شرح"
          />
          <div>
            <div className="mb-1 text-sm text-zinc-700">از تاریخ</div>
            <DatePicker
              value={isoToPersianDateObject(filters.from)}
              onChange={(value) => updateFilter("from", persianValueToIso(value))}
              calendar={persian}
              locale={persian_fa}
              format="YYYY/MM/DD"
              calendarPosition="bottom-right"
              inputClass="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
              containerClassName="rtl w-full"
            />
          </div>
          <div>
            <div className="mb-1 text-sm text-zinc-700">تا تاریخ</div>
            <DatePicker
              value={isoToPersianDateObject(filters.to)}
              onChange={(value) => updateFilter("to", persianValueToIso(value))}
              calendar={persian}
              locale={persian_fa}
              format="YYYY/MM/DD"
              calendarPosition="bottom-right"
              inputClass="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
              containerClassName="rtl w-full"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={applyFilters} disabled={loading}>
            <Search size={16} />
            جستجو
          </Button>
          <Button variant="secondary" onClick={clearFilters} disabled={loading}>
            <X size={16} />
            پاک کردن فیلترها
          </Button>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} />
            تازه‌سازی
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="بایگانی سندی یافت نشد"
      />

      <Pagination
        page={page}
        totalPages={data.totalPages || 0}
        onPage={(nextPage) => {
          setPage(nextPage);
          load({ nextPage });
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف بایگانی"
        message="آیا از حذف این بایگانی مطمئن هستید؟ همه اسناد متعلق به این بایگانی نیز حذف خواهند شد."
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
