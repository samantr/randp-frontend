import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../common/Button";
import Pagination from "../table/Pagination";
import ConfirmDialog from "../common/ConfirmDialog";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

import {
  deleteTransaction,
  getTransactionById,
  getTransactions,
} from "../../api/transactionsApi";
import QuickAddTransactionModal from "./QuickAddTransactionModal";
import EditTransactionModal from "./EditTransactionModal";

import { getPersons } from "../../api/personsApi";
import { getProjects } from "../../api/projectsApi";
import { lookupDisplayName } from "../../utils/lookupOptions";

/* ======================
   Jalali helpers (DISPLAY ONLY)
   ====================== */
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";

function isoToJalaliText(iso) {
  if (!iso) return "-";
  try {
    return new DateObject({
      date: iso,
      format: "YYYY-MM-DD",
      calendar: gregorian,
      locale: persian_fa,
    })
      .convert(persian)
      .format("YYYY/MM/DD");
  } catch {
    return iso;
  }
}

/* ====================== */

function normalizePageLike(data) {
  if (Array.isArray(data)) return { content: data, totalPages: 1 };
  if (data?.content) return data;
  return { content: [], totalPages: 0 };
}

function personLabel(p) {
  if (!p) return "-";
  if (p.isLegal) return p.companyName || `#${p.id}`;
  const full = `${p.name || ""} ${p.lastName || ""}`.trim();
  return full || p.companyName || `#${p.id}`;
}

function paymentTypeLabel(code) {
  if (code === "CSH") return "نقد";
  if (code === "CHK") return "چک";
  if (code === "OTH") return "سایر";
  return code || "-";
}

function transactionTypeLabel(code) {
  if (code === "EXP") return "هزینه";
  if (code === "TRN") return "تراکنش";
  if (code === "OTH") return "سایر";
  return code || "-";
}

function moneyFa(v) {
  return Number(v || 0).toLocaleString("fa-IR");
}

function normalizeText(v) {
  return String(v ?? "")
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
    )
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
    )
    .replace(/[,\u066C]/g, "")
    .trim()
    .toLowerCase();
}

function toDateSortable(v) {
  const t = Date.parse(v || "");
  return Number.isFinite(t) ? t : 0;
}

const EMPTY_CF = {
  code: "",
  project: "",
  from: "",
  to: "",
  dateDue: "",
  amountPaid: "",
  relatedAmount: "",
  allocatedAmount: "",
  remainingAmount: "",
  paymentType: "",
  transactionType: "",
  dsc: "",
};

const EMPTY_EXACT_FILTERS = {
  transactionId: null,
  projectId: null,
  categoryId: null,
  fromPid: null,
  toPid: null,
  transactionType: "",
  from: "",
  to: "",
};

const CF_KEYS = Object.keys(EMPTY_CF);

function parseIntSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseNullableInt(value) {
  if (value == null || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);

  return Number.isSafeInteger(number) && number > 0
    ? number
    : null;
}

function parseStateFromSearchParams(sp) {
  const page = parseIntSafe(sp.get("page"), 0);

  const sortKey = sp.get("sortKey");
  const sortDir = sp.get("sortDir");

  const sort =
    sortKey && (sortDir === "asc" || sortDir === "desc")
      ? { key: sortKey, dir: sortDir }
      : { key: "dateRegistered", dir: "desc" };

  const cf = { ...EMPTY_CF };

  for (const key of CF_KEYS) {
    cf[key] = sp.get(`cf_${key}`) ?? "";
  }

  const exactFilters = {
    transactionId: parseNullableInt(
      sp.get("transactionId"),
    ),
    projectId: parseNullableInt(sp.get("projectId")),
    categoryId: parseNullableInt(sp.get("categoryId")),
    fromPid: parseNullableInt(sp.get("fromPid")),
    toPid: parseNullableInt(sp.get("toPid")),
    transactionType: sp.get("transactionType") ?? "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
  };

  return {
    page,
    sort,
    cf,
    exactFilters,
  };
}

function buildSearchParamsObject({
  page,
  sort,
  cf,
  exactFilters,
}) {
  const params = {
    page: String(page ?? 0),
  };

  if (sort?.key && sort?.dir) {
    params.sortKey = sort.key;
    params.sortDir = sort.dir;
  }

  const filters = exactFilters ?? EMPTY_EXACT_FILTERS;

  if (filters.transactionId != null) {
    params.transactionId = String(filters.transactionId);
  }

  if (filters.projectId != null) {
    params.projectId = String(filters.projectId);
  }

  if (filters.categoryId != null) {
    params.categoryId = String(filters.categoryId);
  }

  if (filters.fromPid != null) {
    params.fromPid = String(filters.fromPid);
  }

  if (filters.toPid != null) {
    params.toPid = String(filters.toPid);
  }

  if (filters.transactionType?.trim()) {
    params.transactionType =
      filters.transactionType.trim();
  }

  if (filters.from?.trim()) {
    params.from = filters.from.trim();
  }

  if (filters.to?.trim()) {
    params.to = filters.to.trim();
  }

  for (const key of CF_KEYS) {
    const value = cf?.[key];

    if (value != null && String(value).trim() !== "") {
      params[`cf_${key}`] = String(value);
    }
  }

  return params;
}

function stableSerializeParamsObject(obj) {
  const keys = Object.keys(obj).sort();
  return keys.map((k) => `${k}=${obj[k]}`).join("&");
}

const HeaderFilterInput = React.memo(function HeaderFilterInput({
  value,
  onChange,
  placeholder = "فیلتر...",
}) {
  return (
    <input
      className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs bg-white"
      placeholder={placeholder}
      value={value || ""}
      onChange={onChange}
    />
  );
});

const SortableHeader = React.memo(function SortableHeader({
  title,
  icon,
  onClick,
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 font-semibold"
      onClick={onClick}
    >
      <span>{title}</span>
      <span className="text-xs text-zinc-500">{icon}</span>
    </button>
  );
});

export default function TransactionsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const lastAppliedUrlRef = useRef("");
  const lastPushedStateRef = useRef("");
  const latestRequestRef = useRef(0);

  const initial = useMemo(
    () => parseStateFromSearchParams(searchParams),
    [] // eslint-disable-line
  );

  const [page, setPage] = useState(initial.page);
  const [size] = useState(20);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ content: [], totalPages: 0 });

  const [deleteId, setDeleteId] = useState(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const [cf, setCf] = useState(initial.cf);
  const [sort, setSort] = useState(initial.sort);

  const [exactFilters, setExactFilters] = useState(
    initial.exactFilters,
  );

  const [personsMap, setPersonsMap] = useState({});
  const [projectsMap, setProjectsMap] = useState({});

  const hasClientSideFilters = useMemo(
    () =>
      Object.entries(cf).some(
        ([key, value]) =>
          key !== "amountPaid" && normalizeText(value) !== "",
      ),
    [cf],
  );

  useEffect(() => {
  const parsed = parseStateFromSearchParams(searchParams);

  const nextObject = buildSearchParamsObject(parsed);
  const nextSignature =
    stableSerializeParamsObject(nextObject);

  if (nextSignature === lastAppliedUrlRef.current) {
    return;
  }

  lastAppliedUrlRef.current = nextSignature;

  setPage(parsed.page);
  setSort(parsed.sort);
  setCf(parsed.cf);
  setExactFilters(parsed.exactFilters);
}, [searchParams]);

useEffect(() => {
  const object = buildSearchParamsObject({
    page,
    sort,
    cf,
    exactFilters,
  });

  const signature = stableSerializeParamsObject(object);

  if (signature === lastPushedStateRef.current) {
    return;
  }

  lastPushedStateRef.current = signature;

  setSearchParams(object, { replace: true });
}, [
  page,
  sort,
  cf,
  exactFilters,
  setSearchParams,
]);

 
  const loadLookups = useCallback(async () => {
    try {
      const personsRes = await getPersons({ page: 0, size: 5000, q: "" });
      const persons = normalizePageLike(personsRes).content || [];
      const pm = {};
      for (const p of persons) pm[p.id] = personLabel(p);
      setPersonsMap(pm);
    } catch {}

    try {
      const projectsRes = await getProjects({ page: 0, size: 5000, q: "" });
      const projects =
        normalizePageLike(projectsRes).content || projectsRes || [];
      const pr = {};
      for (const p of projects) pr[p.id] = lookupDisplayName(p);
      setProjectsMap(pr);
    } catch {}
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

 const load = useCallback(
  async ({ nextPage = page } = {}) => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);

    try {
      const requestSize = hasClientSideFilters ? 200 : size;
      const firstResponse = normalizePageLike(await getTransactions({
        page: hasClientSideFilters ? 0 : nextPage,
        size: requestSize,
        q: "",
        ...exactFilters,
        amountPaid: cf.amountPaid,
      }));

      let response = firstResponse;

      // Text filters need the complete server result before local filtering.
      // Otherwise each page is filtered separately and matches get scattered.
      if (hasClientSideFilters && firstResponse.totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from(
            { length: firstResponse.totalPages - 1 },
            (_, index) =>
              getTransactions({
                page: index + 1,
                size: requestSize,
                q: "",
                ...exactFilters,
                amountPaid: cf.amountPaid,
              }),
          ),
        );

        response = {
          ...firstResponse,
          content: [
            ...(firstResponse.content || []),
            ...remainingPages.flatMap(
              (result) => normalizePageLike(result).content || [],
            ),
          ],
        };
      }

      if (requestId === latestRequestRef.current) {
        setData(response);
      }
    } catch (error) {
      if (requestId !== latestRequestRef.current) {
        return;
      }

      toast.error(
        getApiErrorMessage(
          error,
          "خطا در دریافت لیست تراکنش‌ها",
        ),
      );

      setData({
        content: [],
        totalPages: 0,
      });
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
      }
    }
  },
  [page, size, exactFilters, cf.amountPaid, hasClientSideFilters],
);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [page, load]);

  const rowValue = useCallback(
    (r, key) => {
      if (!r) return "";

      if (key === "dateDue")
        return isoToJalaliText(r.dateDue);

      if (key === "dateRegistered")
        return isoToJalaliText(String(r.dateRegistered || "").slice(0, 10));

      if (key === "project") {
        const id = r.projectId || r.project?.id;
        return id ? projectsMap[id] || `#${id}` : "-";
      }

      if (key === "from") {
        const id = r.fromPersonId || r.fromPerson?.id;
        return id ? personsMap[id] || `#${id}` : "-";
      }

      if (key === "to") {
        const id = r.toPersonId || r.toPerson?.id;
        return id ? personsMap[id] || `#${id}` : "-";
      }

      if (key === "amountPaid") return r.amountPaid ?? "";
      if (key === "allocatedAmount") return r.allocatedAmount ?? "";
      if (key === "remainingAmount") return r.remainingAmount ?? "";

      if (key === "paymentType") return paymentTypeLabel(r.paymentType);
      if (key === "transactionType")
        return transactionTypeLabel(r.transactionType);

      if (key === "relatedAmount") {
        return r.relatedAmount ?? "";
      }

      return r[key] ?? "";
    },
    [personsMap, projectsMap]
  );

const filteredSortedRows = useMemo(() => {
  const rows = data.content || [];

  const filtered = rows.filter((row) => {
    for (const key of Object.keys(cf)) {
      // This filter is applied by the backend before pagination.
      if (key === "amountPaid") continue;

      const needle = normalizeText(cf[key]);

      if (!needle) continue;

      const value = rowValue(row, key);
      const haystack = normalizeText(value);

      if (!haystack.includes(needle)) {
        return false;
      }
    }

    return true;
  });

  if (!sort.key || !sort.dir) {
    return filtered;
  }

  const direction = sort.dir === "asc" ? 1 : -1;

  return [...filtered].sort((first, second) => {
    if (sort.key === "dateDue") {
      return (
        direction *
        (toDateSortable(first.dateDue) -
          toDateSortable(second.dateDue))
      );
    }

    if (sort.key === "dateRegistered") {
      return (
        direction *
        (toDateSortable(first.dateRegistered) -
          toDateSortable(second.dateRegistered))
      );
    }

    if (
      [
        "amountPaid",
        "relatedAmount",
        "allocatedAmount",
        "remainingAmount",
      ].includes(sort.key)
    ) {
      const firstValue = Number(rowValue(first, sort.key) || 0);
      const secondValue = Number(rowValue(second, sort.key) || 0);

      return direction * (firstValue - secondValue);
    }

    const firstValue = normalizeText(
      rowValue(first, sort.key),
    );

    const secondValue = normalizeText(
      rowValue(second, sort.key),
    );

    if (firstValue < secondValue) return -1 * direction;
    if (firstValue > secondValue) return 1 * direction;

    return 0;
  });
}, [data.content, cf, sort, rowValue]);

const visibleRows = useMemo(
  () =>
    hasClientSideFilters
      ? filteredSortedRows.slice(page * size, (page + 1) * size)
      : filteredSortedRows,
  [filteredSortedRows, hasClientSideFilters, page, size],
);

const displayedTotalPages = hasClientSideFilters
  ? Math.ceil(filteredSortedRows.length / size)
  : data.totalPages || 0;

useEffect(() => {
  if (page > 0 && page >= displayedTotalPages) {
    setPage(Math.max(displayedTotalPages - 1, 0));
  }
}, [page, displayedTotalPages]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: null, dir: null };
    });
  }

  function sortIcon(key) {
    if (sort.key !== key || !sort.dir) return "⇅";
    return sort.dir === "asc" ? "↑" : "↓";
  }

  async function handleDelete() {
    try {
      await deleteTransaction(deleteId);
      toast.success("حذف شد");
      setDeleteId(null);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در حذف"));
    }
  }

  const showRelatedAmount =
  exactFilters.categoryId != null;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold">تراکنش‌ها (دریافت/پرداخت)</div>
        <Button onClick={() => setQuickAddOpen(true)}>+ جدید</Button>
      </div>

      <div className="mb-3 rounded-2xl border bg-white p-3 overflow-auto">
        <table className="w-full text-sm ">
          <thead className="text-zinc-600">
            {/* HEADER */}
            <tr className="border-b">
              <th className="py-2 text-right w-12">#</th>

              <th className="py-2 text-right w-28">
                <SortableHeader
                  title="کد"
                  icon={sortIcon("code")}
                  onClick={() => toggleSort("code")}
                />
              </th>

              <th className="py-2 text-right w-44">
                <SortableHeader
                  title="پروژه"
                  icon={sortIcon("project")}
                  onClick={() => toggleSort("project")}
                />
              </th>

              <th className="py-2 text-right w-40">
                <SortableHeader
                  title="از"
                  icon={sortIcon("from")}
                  onClick={() => toggleSort("from")}
                />
              </th>

              <th className="py-2 text-right w-40">
                <SortableHeader
                  title="به"
                  icon={sortIcon("to")}
                  onClick={() => toggleSort("to")}
                />
              </th>

              <th className="py-2 text-right w-28">
                <SortableHeader
                  title="سررسید"
                  icon={sortIcon("dateDue")}
                  onClick={() => toggleSort("dateDue")}
                />
              </th>

              <th className="py-2 text-right w-28">
                <SortableHeader
                  title="مبلغ"
                  icon={sortIcon("amountPaid")}
                  onClick={() => toggleSort("amountPaid")}
                />
              </th>

              {showRelatedAmount && (
                <th className="py-2 text-right w-32">
                  <SortableHeader
                    title="مبلغ مرتبط"
                    icon={sortIcon("relatedAmount")}
                    onClick={() => toggleSort("relatedAmount")}
                  />
                </th>
              )}
              <th className="py-2 text-right w-28">
                <SortableHeader
                  title="تخصیص"
                  icon={sortIcon("allocatedAmount")}
                  onClick={() => toggleSort("allocatedAmount")}
                />
              </th>

              <th className="py-2 text-right w-28">
                <SortableHeader
                  title="مانده"
                  icon={sortIcon("remainingAmount")}
                  onClick={() => toggleSort("remainingAmount")}
                />
              </th>

              <th className="py-2 text-right w-28">
                <SortableHeader
                  title="نوع پرداخت"
                  icon={sortIcon("paymentType")}
                  onClick={() => toggleSort("paymentType")}
                />
              </th>

              <th className="py-2 text-right w-28">
                <SortableHeader
                  title="نوع تراکنش"
                  icon={sortIcon("transactionType")}
                  onClick={() => toggleSort("transactionType")}
                />
              </th>

              <th className="py-2 text-right w-56">
                <SortableHeader
                  title="توضیحات"
                  icon={sortIcon("dsc")}
                  onClick={() => toggleSort("dsc")}
                />
              </th>

              <th className="py-2 text-right w-72 sticky right-0 z-20 bg-white">
                عملیات
              </th>
            </tr>

            {/* FILTERS (aligned under headers) */}
            <tr className="border-b bg-zinc-50">
              <th className="py-2" />

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.code}
                  onChange={(e) =>
                    setCf((p) => ({ ...p, code: e.target.value }))
                  }
                />
              </th>

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.project}
                  onChange={(e) =>
                    setCf((p) => ({ ...p, project: e.target.value }))
                  }
                />
              </th>

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.from}
                  onChange={(e) =>
                    setCf((p) => ({ ...p, from: e.target.value }))
                  }
                />
              </th>

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.to}
                  onChange={(e) => setCf((p) => ({ ...p, to: e.target.value }))}
                />
              </th>

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.dateDue}
                  onChange={(e) =>
                    setCf((p) => ({ ...p, dateDue: e.target.value }))
                  }
                />
              </th>

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.amountPaid}
                onChange={(e) => {
                    setPage(0);

                    setCf((previous) => ({
                      ...previous,
                      amountPaid: e.target.value,
                    }));
                  }}
                />
              </th>

              {showRelatedAmount && (
                <th className="py-2">
                  <HeaderFilterInput
                    value={cf.relatedAmount}
                    onChange={(event) =>
                      setCf((previous) => ({
                        ...previous,
                        relatedAmount: event.target.value,
                      }))
                    }
                  />
                </th>
              )}
              <th className="py-2">
                <HeaderFilterInput
                  value={cf.allocatedAmount}
                  onChange={(e) =>
                    setCf((p) => ({ ...p, allocatedAmount: e.target.value }))
                  }
                />
              </th>

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.remainingAmount}
                  onChange={(e) =>
                    setCf((p) => ({ ...p, remainingAmount: e.target.value }))
                  }
                />
              </th>

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.paymentType}
                  onChange={(e) =>
                    setCf((p) => ({ ...p, paymentType: e.target.value }))
                  }
                />
              </th>

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.transactionType}
                  onChange={(e) =>
                    setCf((p) => ({ ...p, transactionType: e.target.value }))
                  }
                />
              </th>

              <th className="py-2">
                <HeaderFilterInput
                  value={cf.dsc}
                  onChange={(e) =>
                    setCf((p) => ({ ...p, dsc: e.target.value }))
                  }
                />
              </th>

              <th className="py-2 sticky right-0 z-20 bg-zinc-50">
                <button
                  type="button"
                  className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs hover:bg-white"
                  onClick={() => {
                    setCf({ ...EMPTY_CF });
                    setExactFilters({ ...EMPTY_EXACT_FILTERS });
                    setSort({ key: null, dir: null });
                    setPage(0);
                  }}
                >
                  پاک‌کردن
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={showRelatedAmount ? 14 : 13} className="py-4 text-center text-zinc-500">
                  در حال بارگذاری...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={showRelatedAmount ? 14 : 13} className="py-4 text-center text-zinc-500">
                  موردی یافت نشد.
                </td>
              </tr>
            ) : (
              visibleRows.map((r, idx) => {
                const rowNo = page * size + idx + 1;
                return (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2 text-zinc-500">{rowNo}</td>

                    <td className="py-2 font-semibold ">
                      {r.code || "-"}
                    </td>
                    <td className="py-2 ">{rowValue(r, "project")}</td>
                    <td className="py-2 ">{rowValue(r, "from")}</td>
                    <td className="py-2 ">{rowValue(r, "to")}</td>
                    <td className="py-2">{rowValue(r, "dateDue")}</td>

                    <td className="py-2 font-semibold">
                      {r.amountPaid != null ? moneyFa(r.amountPaid) : "-"}
                    </td>

                    {showRelatedAmount && (
                      <td className="py-2 font-semibold text-blue-700">
                        {r.relatedAmount != null
                          ? moneyFa(r.relatedAmount)
                          : "-"}
                      </td>
                    )}

                    <td className="py-2 font-semibold">
                      {r.allocatedAmount != null
                        ? moneyFa(r.allocatedAmount)
                        : "-"}
                    </td>
                    <td className="py-2 font-semibold">
                      {r.remainingAmount != null
                        ? moneyFa(r.remainingAmount)
                        : "-"}
                    </td>

                    <td className="py-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">
                        {paymentTypeLabel(r.paymentType)}
                      </span>
                    </td>

                    <td className="py-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">
                        {transactionTypeLabel(r.transactionType)}
                      </span>
                    </td>

                    <td className="py-2 ">{r.dsc || "-"}</td>

                    <td className="py-2 sticky right-0 z-10 bg-white">
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            navigate(`/transactions/${r.id}/allocations`)
                          }
                        >
                          تخصیص‌ها
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() =>
                            navigate(`/transactions/${r.id}/documents`)
                          }
                        >
                          پیوست‌ها
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={async () => {
                            try {
                              setEditLoading(true);
                              setEditing(null);
                              setEditOpen(true);
                              const fresh = await getTransactionById(r.id);
                              setEditing(fresh);
                            } catch (e) {
                              toast.error(
                                getApiErrorMessage(
                                  e,
                                  "خطا در دریافت اطلاعات تراکنش"
                                )
                              );
                              setEditOpen(false);
                            } finally {
                              setEditLoading(false);
                            }
                          }}
                        >
                          ویرایش
                        </Button>

                        <Button
                          variant="danger"
                          onClick={() => setDeleteId(r.id)}
                        >
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

      <Pagination
        page={page}
        totalPages={displayedTotalPages}
        onPage={setPage}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="حذف تراکنش"
        message="آیا از حذف این مورد مطمئن هستید؟"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          await handleDelete();
        }}
      />

      <QuickAddTransactionModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={async () => {
          await loadLookups();
          setPage(0);
          await load({ nextPage: 0 });
        }}
      />

      <EditTransactionModal
        key={editing?.id || (editOpen ? "loading" : "closed")}
        open={editOpen}
        transaction={editing}
        loading={editLoading}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
          setEditLoading(false);
        }}
        onUpdated={async () => {
          await loadLookups();
          await load();
        }}
      />
    </>
  );
}
