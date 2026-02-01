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
  return String(v ?? "").trim().toLowerCase();
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
  allocatedAmount: "",
  remainingAmount: "",
  paymentType: "",
  transactionType: "",
  dsc: "",
};

const CF_KEYS = Object.keys(EMPTY_CF);

function parseIntSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseNullableInt(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseStateFromSearchParams(sp) {
  const page = parseIntSafe(sp.get("page"), 0);

  // ✅ exact id filters (from Dashboard drill)
  const toPid = parseNullableInt(sp.get("toPid"));
  const fromPid = parseNullableInt(sp.get("fromPid"));

  const sortKey = sp.get("sortKey");
  const sortDir = sp.get("sortDir");

  const sort =
    sortKey && (sortDir === "asc" || sortDir === "desc")
      ? { key: sortKey, dir: sortDir }
      : { key: "dateRegistered", dir: "desc" };

  const cf = { ...EMPTY_CF };
  for (const k of CF_KEYS) {
    const v = sp.get(`cf_${k}`);
    cf[k] = v ?? "";
  }

  return { page, sort, cf, toPid, fromPid };
}



function buildSearchParamsObject({ page, sort, cf, toPid, fromPid }) {
  const params = {};
  params.page = String(page ?? 0);

  if (sort?.key && sort?.dir) {
    params.sortKey = sort.key;
    params.sortDir = sort.dir;
  }

  // ✅ keep id filters in URL
  if (toPid != null) params.toPid = String(toPid);
  if (fromPid != null) params.fromPid = String(fromPid);

  for (const k of CF_KEYS) {
    const v = cf?.[k];
    if (v != null && String(v).trim() !== "") {
      params[`cf_${k}`] = String(v);
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

  // ✅ exact person id filters (URL: ?toPid=123 / ?fromPid=123)
  const [toPid, setToPid] = useState(initial.toPid ?? null);
  const [fromPid, setFromPid] = useState(initial.fromPid ?? null);

  const [personsMap, setPersonsMap] = useState({});
  const [projectsMap, setProjectsMap] = useState({});

  useEffect(() => {
    const parsed = parseStateFromSearchParams(searchParams);
    const nextObj = buildSearchParamsObject(parsed);
    const nextSig = stableSerializeParamsObject(nextObj);

    if (nextSig === lastAppliedUrlRef.current) return;
    lastAppliedUrlRef.current = nextSig;

    setPage(parsed.page);
    setSort(parsed.sort);
    setCf(parsed.cf);

    setToPid(parsed.toPid ?? null);
    setFromPid(parsed.fromPid ?? null);

  }, [searchParams]);

  useEffect(() => {
    const obj = buildSearchParamsObject({  page, sort, cf, toPid, fromPid });
    const sig = stableSerializeParamsObject(obj);

    if (sig === lastPushedStateRef.current) return;
    lastPushedStateRef.current = sig;

    setSearchParams(obj, { replace: true });
  }, [ page, sort, cf, toPid, fromPid, setSearchParams]);

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
      for (const p of projects) pr[p.id] = p.title || `#${p.id}`;
      setProjectsMap(pr);
    } catch {}
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const load = useCallback(
    async ({ nextPage = page } = {}) => {
      setLoading(true);
      try {
        const res = await getTransactions({ q: "", page: nextPage, size });
        setData(normalizePageLike(res));
      } catch (e) {
        toast.error(getApiErrorMessage(e, "خطا در دریافت لیست تراکنش‌ها"));
        setData({ content: [], totalPages: 0 });
      } finally {
        setLoading(false);
      }
    },
    [page, size]
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

      return r[key] ?? "";
    },
    [personsMap, projectsMap]
  );

  const filteredSortedRows = useMemo(() => {
    const rows = data.content || [];

    const filtered = rows.filter((r) => {
  // ✅ exact ID filters first
  if (toPid != null) {
    const rid = r.toPersonId || r.toPerson?.id;
    if (Number(rid) !== Number(toPid)) return false;
  }
  if (fromPid != null) {
    const rid = r.fromPersonId || r.fromPerson?.id;
    if (Number(rid) !== Number(fromPid)) return false;
  }

  for (const k of Object.keys(cf)) {
    const needle = normalizeText(cf[k]);
    if (!needle) continue;

    const val = rowValue(r, k);
    const hay = normalizeText(val);
    if (!hay.includes(needle)) return false;
  }
  return true;
});


    if (!sort.key || !sort.dir) return filtered;

    const dirMul = sort.dir === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (sort.key === "dateDue")
        return dirMul * (toDateSortable(a.dateDue) - toDateSortable(b.dateDue));
      if (sort.key === "dateRegistered")
        return (
          dirMul *
          (toDateSortable(a.dateRegistered) -
            toDateSortable(b.dateRegistered))
        );

      const va = normalizeText(rowValue(a, sort.key));
      const vb = normalizeText(rowValue(b, sort.key));
      if (va < vb) return -1 * dirMul;
      if (va > vb) return 1 * dirMul;
      return 0;
    });
  }, [data.content, cf, sort, rowValue, toPid, fromPid]);

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
                  onChange={(e) =>
                    setCf((p) => ({ ...p, amountPaid: e.target.value }))
                  }
                />
              </th>

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
                    setSort({ key: null, dir: null });
                    // optional: setPage(0);  // uncomment if you want clear to jump to first page
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
                <td colSpan={13} className="py-4 text-center text-zinc-500">
                  در حال بارگذاری...
                </td>
              </tr>
            ) : filteredSortedRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-4 text-center text-zinc-500">
                  موردی یافت نشد.
                </td>
              </tr>
            ) : (
              filteredSortedRows.map((r, idx) => {
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
        totalPages={data.totalPages || 0}
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
