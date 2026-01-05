import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import Button from "../common/Button.jsx";
import Input from "../common/Input.jsx";
import LookupSelect from "../lookup/LookupSelect.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";

import {
  getAllDebts,
  deleteDebt,
  getDebtView,
  createDebt,
  updateDebt,
} from "../../api/debtsApi";

import { getProjects } from "../../api/projectsApi";
import { getPersons } from "../../api/personsApi";
import { getItems } from "../../api/itemsApi";
import { getUnits } from "../../api/unitsApi";

import QuickAddPersonModal from "../persons/QuickAddPersonModal.jsx";
import { normalizeFaText } from "../../utils/normalizeFa";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

/** yyyy-mm-ddTHH:mm */
function nowLocalISOForInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** yyyy-mm-dd */
function nowLocalISODateForInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function moneyFa(v) {
  return Number(v || 0).toLocaleString("fa-IR");
}

function safeList(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.content)) return x.content;
  return [];
}

function personTitle(p) {
  if (!p) return "";
  const isLegal = !!p.isLegal;
  const t = isLegal
    ? p.companyName || p.name || ""
    : `${p.name || ""} ${p.lastName || ""}`.trim();
  return t || `#${p.id}`;
}

function getAny(obj, keys, def = null) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return def;
}

async function loadAllPaged(fetchPageFn, pageSize = 200, maxPages = 50) {
  const all = [];
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchPageFn({ page, size: pageSize });
    const chunk = safeList(res);
    all.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return all;
}

// --------------------
// URL state helpers
// --------------------
const EMPTY_HF = {
  project: "",
  person: "",
  dateDue: "",
  total: "",
  covered: "",
  remaining: "",
  dsc: "",
};
const HF_KEYS = Object.keys(EMPTY_HF);

function intOr(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseStateFromUrl(sp) {
  const pi = intOr(sp.get("pi"), 0);

  const sortBy = sp.get("sb") || null;
  const sortDir = sp.get("sd") === "desc" ? "desc" : "asc";

  const sidRaw = sp.get("sid");
  const sid =
    sidRaw != null && sidRaw !== "" && Number.isFinite(Number(sidRaw))
      ? Number(sidRaw)
      : null;

  const hf = { ...EMPTY_HF };
  for (const k of HF_KEYS) hf[k] = sp.get(`hf_${k}`) ?? "";

  return { pi, sortBy, sortDir, sid, hf };
}

function buildUrlParams({ pi, sortBy, sortDir, sid, hf }) {
  const obj = {};
  obj.pi = String(pi ?? 0);

  if (sortBy) obj.sb = String(sortBy);
  if (sortBy) obj.sd = sortDir === "desc" ? "desc" : "asc";

  if (sid != null && sid !== "") obj.sid = String(sid);

  for (const k of HF_KEYS) {
    const v = hf?.[k];
    if (v != null && String(v).trim() !== "") obj[`hf_${k}`] = String(v);
  }

  return obj;
}

function shallowEqualObj(a, b) {
  const ak = Object.keys(a || {});
  const bk = Object.keys(b || {});
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="text-zinc-300">⇅</span>;
  return <span className="text-zinc-500">{dir === "asc" ? "↑" : "↓"}</span>;
}

function SortButton({ label, active, dir, onClick }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 w-full justify-start select-none"
      onClick={onClick}
    >
      <span>{label}</span>
      <SortIcon active={active} dir={dir} />
    </button>
  );
}

export default function DebtsMasterDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // init from URL once
  const initialRef = useRef(null);
  if (!initialRef.current) initialRef.current = parseStateFromUrl(searchParams);
  const initial = initialRef.current;

  // list & selection
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [headers, setHeaders] = useState([]);
  const [selectedDebtId, setSelectedDebtId] = useState(initial.sid);

  // detail
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailView, setDetailView] = useState(null);

  // mode
  const [mode, setMode] = useState("view"); // view | create | edit
  const [saving, setSaving] = useState(false);

  // header form
  const [headerProject, setHeaderProject] = useState(null);
  const [headerPerson, setHeaderPerson] = useState(null);
  const [dateRegistered, setDateRegistered] = useState(nowLocalISOForInput());
  const [dateDue, setDateDue] = useState(nowLocalISODateForInput());
  const [headerDsc, setHeaderDsc] = useState("");

  // lines
  const [editLines, setEditLines] = useState([]);

  // delete
  const [deleteId, setDeleteId] = useState(null);

  // quick add person
  const [quickAddPersonOpen, setQuickAddPersonOpen] = useState(false);

  // maps
  const [projectsMap, setProjectsMap] = useState(new Map());
  const [personsMap, setPersonsMap] = useState(new Map());

  // filters/sort/paging
  const [hf, setHf] = useState(initial.hf || { ...EMPTY_HF });
  const [sortBy, setSortBy] = useState(initial.sortBy);
  const [sortDir, setSortDir] = useState(initial.sortDir || "asc");
  const PAGE_SIZE = 5;
  const [pageIndex, setPageIndex] = useState(initial.pi || 0);

  // ✅ key: ONLY auto-pick first row when we explicitly want
  const autoPickFirstRef = useRef(false);

  // compute returnTo (encoded)
  const returnTo = useMemo(() => {
    return encodeURIComponent(`${location.pathname}${location.search || ""}`);
  }, [location.pathname, location.search]);

  // --------------------
  // URL -> state (Back/Forward / Return)
  // --------------------
  const lastAppliedSigRef = useRef("");
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const parsed = parseStateFromUrl(sp);
    const sig = JSON.stringify(parsed);

    if (sig === lastAppliedSigRef.current) return;
    lastAppliedSigRef.current = sig;

    // ✅ coming from allocations/docs/back => pick first row of current list
    //autoPickFirstRef.current = true;

    setPageIndex(parsed.pi);
    setSortBy(parsed.sortBy);
    setSortDir(parsed.sortDir || "asc");
    setHf(parsed.hf);

    if (parsed.sid != null) setSelectedDebtId(parsed.sid);
  }, [location.search]);

  // --------------------
  // state -> URL (debounced)
  // --------------------
  const urlTimer = useRef(null);
  const lastPushedRef = useRef(null);

  useEffect(() => {
    if (mode !== "view") return;

    if (urlTimer.current) clearTimeout(urlTimer.current);

    urlTimer.current = setTimeout(() => {
      const desired = buildUrlParams({
        pi: pageIndex,
        sortBy,
        sortDir,
        sid: selectedDebtId,
        hf,
      });

      const currentSp = new URLSearchParams(location.search);
      const current = {};
      for (const [k, v] of currentSp.entries()) current[k] = v;

      if (shallowEqualObj(current, desired)) return;
      if (lastPushedRef.current && shallowEqualObj(lastPushedRef.current, desired)) return;

      lastPushedRef.current = desired;
      setSearchParams(desired, { replace: true });
    }, 250);

    return () => {
      if (urlTimer.current) clearTimeout(urlTimer.current);
    };
  }, [mode, pageIndex, sortBy, sortDir, selectedDebtId, hf, location.search, setSearchParams]);

  function toggleSort(field) {
    // ✅ sorting should also show first row detail
    autoPickFirstRef.current = true;

    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  function goPrevPage() {
    autoPickFirstRef.current = true;
    setPageIndex((p) => Math.max(0, p - 1));
  }

  function goNextPage(totalPages) {
    autoPickFirstRef.current = true;
    setPageIndex((p) => Math.min(totalPages - 1, p + 1));
  }

  // preload maps
  useEffect(() => {
    (async () => {
      try {
        const [projectsRaw, personsAll] = await Promise.all([
          getProjects(),
          loadAllPaged(getPersons, 200, 50),
        ]);
        const projects = safeList(projectsRaw);

        const pMap = new Map();
        for (const p of projects) pMap.set(p.id, p.title || `#${p.id}`);
        setProjectsMap(pMap);

        const peMap = new Map();
        for (const pe of personsAll) peMap.set(pe.id, personTitle(pe) || `#${pe.id}`);
        setPersonsMap(peMap);
      } catch {
        // ignore
      }
    })();
  }, []);

  // lookups for form
  const fetchProjects = useCallback(async ({ q }) => {
    const data = safeList(await getProjects());
    const nq = (q || "").trim();
    if (!nq) return data;
    return data.filter((x) => String(x?.title || "").includes(nq));
  }, []);

  const fetchPersons = useCallback(async ({ q }) => {
    const persons = await loadAllPaged(getPersons, 200, 50);
    const nq = (q || "").trim();
    if (!nq) return persons;
    return persons.filter((x) =>
      `${x?.name || ""} ${x?.lastName || ""} ${x?.companyName || ""}`.includes(nq)
    );
  }, []);

  const fetchItems = useCallback(async ({ q }) => {
    const data = safeList(await getItems());
    const nq = (q || "").trim();
    if (!nq) return data;
    return data.filter((x) => String(x?.title || "").includes(nq));
  }, []);

  const fetchUnits = useCallback(async ({ q }) => {
    const data = safeList(await getUnits());
    const nq = (q || "").trim();
    if (!nq) return data;
    return data.filter((x) => String(x?.title || "").includes(nq));
  }, []);

  // load headers
  const loadHeaders = useCallback(async () => {
    if (mode !== "view") return;

    setLoadingHeaders(true);
    try {
      const data = await getAllDebts();
      const rows = Array.isArray(data) ? data : [];
      setHeaders(rows);

      // if nothing selected at all, pick first
      if ((!selectedDebtId || selectedDebtId === null) && rows.length > 0) {
        setSelectedDebtId(rows[0]?.debt_id ?? null);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در دریافت لیست بدهی‌ها"));
    } finally {
      setLoadingHeaders(false);
    }
  }, [mode, selectedDebtId]);

  useEffect(() => {
    loadHeaders();
  }, [loadHeaders]);

  // filtering
  const filteredHeaders = useMemo(() => {
    const f = {};
    for (const k of HF_KEYS) f[k] = normalizeFaText(hf[k] || "");

    return (headers || []).filter((r) => {
      const projectId = getAny(r, ["project_id", "projectId", "projectID"]);
      const personId = getAny(r, ["person_id", "personId", "personID"]);

      const projectTitle = normalizeFaText(
        projectId ? projectsMap.get(projectId) || `#${projectId}` : ""
      );
      const personName = normalizeFaText(
        personId ? personsMap.get(personId) || `#${personId}` : ""
      );

      const dateDue = normalizeFaText(String(r.date_due ?? ""));
      const total = normalizeFaText(String(r.total_amount ?? ""));
      const covered = normalizeFaText(String(r.covered_amount ?? ""));
      const remaining = normalizeFaText(String(r.remaining_amount ?? ""));
      const dsc = normalizeFaText(String(r.dsc ?? ""));

      if (f.project && !projectTitle.includes(f.project)) return false;
      if (f.person && !personName.includes(f.person)) return false;
      if (f.dateDue && !dateDue.includes(f.dateDue)) return false;
      if (f.total && !total.includes(f.total)) return false;
      if (f.covered && !covered.includes(f.covered)) return false;
      if (f.remaining && !remaining.includes(f.remaining)) return false;
      if (f.dsc && !dsc.includes(f.dsc)) return false;

      return true;
    });
  }, [headers, hf, projectsMap, personsMap]);

  // when filters change: reset page and mark auto-pick
  const lastFilterSigRef = useRef("");
  useEffect(() => {
    const sig = JSON.stringify(hf);
    if (sig === lastFilterSigRef.current) return;
    lastFilterSigRef.current = sig;

    autoPickFirstRef.current = true;
    setPageIndex(0);
  }, [hf]);

  // sorting
  const sortedHeaders = useMemo(() => {
    if (!sortBy) return filteredHeaders;

    const dir = sortDir === "asc" ? 1 : -1;

    return [...(filteredHeaders || [])].sort((a, b) => {
      const getVal = (r) => {
        switch (sortBy) {
          case "project": {
            const id = getAny(r, ["project_id", "projectId", "projectID"]);
            return id ? projectsMap.get(id) || `#${id}` : "";
          }
          case "person": {
            const id = getAny(r, ["person_id", "personId", "personID"]);
            return id ? personsMap.get(id) || `#${id}` : "";
          }
          case "dateDue":
            return r.date_due || "";
          case "total":
            return Number(r.total_amount || 0);
          case "covered":
            return Number(r.covered_amount || 0);
          case "remaining":
            return Number(r.remaining_amount || 0);
          case "dsc":
            return r.dsc || "";
          default:
            return "";
        }
      };

      const va = getVal(a);
      const vb = getVal(b);

      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "fa") * dir;
    });
  }, [filteredHeaders, sortBy, sortDir, projectsMap, personsMap]);

  const totalPages = useMemo(() => {
    const n = Math.ceil((sortedHeaders?.length || 0) / PAGE_SIZE);
    return Math.max(1, n);
  }, [sortedHeaders]);

  const pagedHeaders = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return (sortedHeaders || []).slice(start, start + PAGE_SIZE);
  }, [sortedHeaders, pageIndex]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) setPageIndex(Math.max(0, totalPages - 1));
  }, [pageIndex, totalPages]);

  // ✅ master changed (filters/sort/page/back): pick first row only when flag is ON,
  // and ALWAYS fix invalid selection (selected not visible)
  useEffect(() => {
    if (mode !== "view") return;

    if (!pagedHeaders || pagedHeaders.length === 0) {
      if (detailView !== null) setDetailView(null);
      return;
    }

    const firstId = pagedHeaders[0]?.debt_id ?? null;
    const selectedExistsInPage =
      selectedDebtId != null && pagedHeaders.some((x) => x.debt_id === selectedDebtId);

    // always fix invalid selection
    if (!selectedExistsInPage) {
      if (firstId != null && Number(firstId) !== Number(selectedDebtId)) {
        setSelectedDebtId(firstId);
      }
      return;
    }

    // only override to first when we intended (filters/sort/page/back)
    if (autoPickFirstRef.current) {
      autoPickFirstRef.current = false;
      if (firstId != null && Number(firstId) !== Number(selectedDebtId)) {
        setSelectedDebtId(firstId);
      }
    }
  }, [mode, pagedHeaders, selectedDebtId, detailView]);

  // --------------------
  // detail load (race-safe + clears stale)
  // --------------------
  const requestSeqRef = useRef(0);

  const loadDetail = useCallback(
    async (debtId) => {
      if (mode !== "view") return;

      if (!debtId) {
        setDetailView(null);
        setLoadingDetail(false);
        return;
      }

      const mySeq = ++requestSeqRef.current;

      setLoadingDetail(true);
      try {
        const v = await getDebtView(debtId);

        // ignore stale response
        if (mySeq !== requestSeqRef.current) return;
        if (Number(debtId) !== Number(selectedDebtId)) return;

        setDetailView(v);
      } catch (e) {
        if (mySeq !== requestSeqRef.current) return;
        toast.error(getApiErrorMessage(e, "خطا در دریافت جزئیات بدهی"));
        setDetailView(null);
      } finally {
        if (mySeq === requestSeqRef.current) setLoadingDetail(false);
      }
    },
    [mode, selectedDebtId]
  );

  useEffect(() => {
    if (mode !== "view") return;

    // clear stale detail immediately
    setDetailView(null);

    loadDetail(selectedDebtId);
  }, [selectedDebtId, loadDetail, mode]);

  // --------------------
  // editable lines helpers
  // --------------------
  function addLine() {
    setEditLines((prev) => [
      ...(prev || []),
      { item: null, unit: null, qnt: 1, unitPrice: "", dsc: "" },
    ]);
  }

  function removeLine(idx) {
    setEditLines((prev) => (prev || []).filter((_, i) => i !== idx));
  }

  function updateLine(idx, patch) {
    setEditLines((prev) =>
      (prev || []).map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );
  }

  function insertLineAfter(idx) {
    setEditLines((prev) => {
      const arr = [...(prev || [])];
      arr.splice(idx + 1, 0, {
        item: null,
        unit: null,
        qnt: 1,
        unitPrice: "",
        dsc: "",
      });
      return arr;
    });
  }

  const editTotal = useMemo(() => {
    return (editLines || []).reduce((sum, l) => {
      const q = Number(l.qnt || 0);
      const p = Number(l.unitPrice || 0);
      return sum + q * p;
    }, 0);
  }, [editLines]);

  // --------------------
  // mode transitions
  // --------------------
  async function startCreate() {
    setMode("create");
    setHeaderProject(null);
    setHeaderPerson(null);
    setDateRegistered(nowLocalISOForInput());
    setDateDue(nowLocalISODateForInput());
    setHeaderDsc("");
    setEditLines([]);
  }

  async function startEdit(debtId) {
    if (!debtId) return;

    setMode("edit");
    setSelectedDebtId(debtId);
    setDetailView(null);

    setLoadingDetail(true);
    try {
      const v = await getDebtView(debtId);
      const h = v?.header;

      let proj = h?.projectId ? { id: h.projectId, title: `#${h.projectId}` } : null;
      let pers = h?.personId
        ? { id: h.personId, name: `#${h.personId}`, isLegal: false }
        : null;

      try {
        const [projectsRaw, personsAll] = await Promise.all([
          getProjects(),
          loadAllPaged(getPersons, 200, 50),
        ]);
        const projects = safeList(projectsRaw);
        const persons = personsAll;

        const p = projects.find((x) => x.id === h?.projectId);
        const pe = persons.find((x) => x.id === h?.personId);
        proj = p || proj;
        pers = pe || pers;
      } catch {}

      setHeaderProject(proj);
      setHeaderPerson(pers);

      setDateRegistered(h?.dateRegistered || nowLocalISOForInput());
      setDateDue(h?.dateDue || nowLocalISODateForInput());
      setHeaderDsc(h?.dsc || "");

      setEditLines(
        (v?.lines || []).map((l) => ({
          item: { id: l.itemId, title: l.itemTitle },
          unit: { id: l.unitId, title: l.unitTitle },
          qnt: Number(l.qnt),
          unitPrice: Number(l.unitPrice),
          dsc: l.dsc || "",
        }))
      );
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در دریافت بدهی برای ویرایش"));
      setMode("view");
    } finally {
      setLoadingDetail(false);
    }
  }

  function cancelEditCreate() {
    setMode("view");
    setSaving(false);
    loadHeaders();
  }

  async function saveDebt() {
    const isEdit = mode === "edit";

    if (!headerProject?.id) return toast.error("پروژه را انتخاب کنید");
    if (!headerPerson?.id) return toast.error("شخص/سازمان را انتخاب کنید");
    if (!dateRegistered) return toast.error("تاریخ ثبت را وارد کنید");
    if (!dateDue) return toast.error("تاریخ سررسید را وارد کنید");
    if (!editLines || editLines.length === 0) return toast.error("حداقل یک ردیف اضافه کنید");

    for (const [i, l] of editLines.entries()) {
      if (!l?.item?.id) return toast.error(`ردیف ${i + 1}: کالا/خدمت انتخاب نشده`);
      if (!l?.unit?.id) return toast.error(`ردیف ${i + 1}: واحد انتخاب نشده`);

      const qnt = Number(l.qnt);
      const price = Number(l.unitPrice);
      if (!Number.isFinite(qnt) || qnt <= 0) return toast.error(`ردیف ${i + 1}: تعداد نامعتبر است`);
      if (!Number.isFinite(price) || price < 0) return toast.error(`ردیف ${i + 1}: قیمت واحد نامعتبر است`);
    }

    const ids = editLines.map((l) => l.item.id);
    if (new Set(ids).size !== ids.length) {
      return toast.error("هر کالا/خدمت فقط یک بار می‌تواند در خطوط بدهی ثبت شود");
    }

    const payload = {
      projectId: headerProject.id,
      personId: headerPerson.id,
      dateRegistered,
      dateDue,
      dsc: headerDsc?.trim() || null,
      lines: editLines.map((l) => ({
        itemId: Number(l.item.id),
        unitId: Number(l.unit.id),
        qnt: Number(l.qnt),
        unitPrice: Number(l.unitPrice),
        dsc: l.dsc?.trim() || null,
      })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        if (!selectedDebtId) return toast.error("بدهی انتخاب نشده");
        await updateDebt(selectedDebtId, payload);
        toast.success("ویرایش شد");
      } else {
        await createDebt(payload);
        toast.success("بدهی ثبت شد");
      }

      setMode("view");
      await loadHeaders();
    } catch (e) {
      toast.error(getApiErrorMessage(e, isEdit ? "خطا در ویرایش" : "خطا در ثبت بدهی"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteDebt(deleteId);
      toast.success("حذف شد");
      setDeleteId(null);
      await loadHeaders();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "حذف ممکن نیست (ممکن است تخصیص/سند داشته باشد)"));
    }
  }

  return (
    <>
      {/* Headers */}
      {mode === "view" && (
        <div className="rounded-2xl border bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Headers</div>
            <Button onClick={startCreate}>+ بدهی جدید</Button>
          </div>

          <div className="flex items-center justify-between gap-2 mb-2 text-sm">
            <div className="text-zinc-600">
              نمایش{" "}
              <b>{pagedHeaders.length === 0 ? 0 : pageIndex * PAGE_SIZE + 1}</b> تا{" "}
              <b>{Math.min((pageIndex + 1) * PAGE_SIZE, sortedHeaders.length)}</b> از{" "}
              <b>{sortedHeaders.length}</b>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={goPrevPage} disabled={pageIndex === 0}>
                قبلی
              </Button>

              <div className="text-zinc-700">
                صفحه <b>{pageIndex + 1}</b> از <b>{totalPages}</b>
              </div>

              <Button
                variant="secondary"
                onClick={() => goNextPage(totalPages)}
                disabled={pageIndex >= totalPages - 1}
              >
                بعدی
              </Button>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-600">
                <tr className="border-b">
                  <th className="py-2 text-right">
                    <SortButton
                      label="پروژه"
                      active={sortBy === "project"}
                      dir={sortDir}
                      onClick={() => toggleSort("project")}
                    />
                  </th>
                  <th className="py-2 text-right">
                    <SortButton
                      label="شخص/سازمان"
                      active={sortBy === "person"}
                      dir={sortDir}
                      onClick={() => toggleSort("person")}
                    />
                  </th>
                  <th className="py-2 text-right">
                    <SortButton
                      label="سررسید"
                      active={sortBy === "dateDue"}
                      dir={sortDir}
                      onClick={() => toggleSort("dateDue")}
                    />
                  </th>
                  <th className="py-2 text-right">
                    <SortButton
                      label="جمع"
                      active={sortBy === "total"}
                      dir={sortDir}
                      onClick={() => toggleSort("total")}
                    />
                  </th>
                  <th className="py-2 text-right">
                    <SortButton
                      label="تخصیص"
                      active={sortBy === "covered"}
                      dir={sortDir}
                      onClick={() => toggleSort("covered")}
                    />
                  </th>
                  <th className="py-2 text-right">
                    <SortButton
                      label="مانده"
                      active={sortBy === "remaining"}
                      dir={sortDir}
                      onClick={() => toggleSort("remaining")}
                    />
                  </th>
                  <th className="py-2 text-right">
                    <SortButton
                      label="توضیحات"
                      active={sortBy === "dsc"}
                      dir={sortDir}
                      onClick={() => toggleSort("dsc")}
                    />
                  </th>
                  <th className="py-2 text-right">وضعیت</th>
                  <th className="py-2 text-right">عملیات</th>
                </tr>

                <tr className="border-b bg-zinc-50">
                  {["project", "person", "dateDue", "total", "covered", "remaining", "dsc"].map((k) => (
                    <th key={k} className="py-2">
                      <input
                        className="w-full rounded-lg border border-zinc-200 px-2 py-2"
                        placeholder="فیلتر..."
                        value={hf[k]}
                        onChange={(e) => {
                          autoPickFirstRef.current = true; // ✅ filters should pick first
                          setHf((p) => ({ ...p, [k]: e.target.value }));
                        }}
                      />
                    </th>
                  ))}
                  <th />
                  <th />
                </tr>
              </thead>

              <tbody>
                {loadingHeaders ? (
                  <tr>
                    <td className="py-3 text-zinc-500" colSpan={9}>
                      در حال بارگذاری...
                    </td>
                  </tr>
                ) : pagedHeaders.length === 0 ? (
                  <tr>
                    <td className="py-3 text-zinc-500" colSpan={9}>
                      موردی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  pagedHeaders.map((r) => {
                    const projectId = getAny(r, ["project_id", "projectId", "projectID"]);
                    const personId = getAny(r, ["person_id", "personId", "personID"]);

                    const projectTitle = projectId ? projectsMap.get(projectId) || `#${projectId}` : "-";
                    const personName = personId ? personsMap.get(personId) || `#${personId}` : "-";

                    const remaining = Number(r.remaining_amount || 0);

                    return (
                      <tr
                        key={r.debt_id}
                        className={`border-b last:border-b-0 cursor-pointer ${
                          r.debt_id === selectedDebtId ? "bg-zinc-50" : ""
                        }`}
                        onClick={() => {
                          // ✅ manual click: DO NOT auto-pick first
                          autoPickFirstRef.current = false;
                          setSelectedDebtId(r.debt_id);
                        }}
                      >
                        <td className="py-2">{projectTitle}</td>
                        <td className="py-2">{personName}</td>
                        <td className="py-2">{r.date_due}</td>
                        <td className="py-2">{moneyFa(r.total_amount)}</td>
                        <td className="py-2">{moneyFa(r.covered_amount)}</td>
                        <td className="py-2 font-semibold">{moneyFa(remaining)}</td>
                        <td className="py-2 max-w-[260px] truncate" title={r.dsc || ""}>
                          {r.dsc || "-"}
                        </td>

                        <td className="py-2">
                          {remaining > 0 ? (
                            <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs">باز</span>
                          ) : (
                            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs">تسویه</span>
                          )}
                        </td>

                        <td className="py-2">
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                navigate(`/debts/${r.debt_id}/allocations?return=${returnTo}`)
                              }
                            >
                              تخصیص‌ها
                            </Button>

                            <Button
                              variant="secondary"
                              onClick={() =>
                                navigate(`/debts/${r.debt_id}/documents?return=${returnTo}`)
                              }
                            >
                              پیوست‌ها
                            </Button>

                            <Button variant="secondary" onClick={() => startEdit(r.debt_id)}>
                              ویرایش
                            </Button>

                            <Button variant="danger" onClick={() => setDeleteId(r.debt_id)}>
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
        </div>
      )}

      {/* Create/Edit header */}
      {mode !== "view" && (
        <div className="rounded-2xl border bg-white p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-lg">
              {mode === "edit" && selectedDebtId ? `ویرایش بدهی #${selectedDebtId}` : "ثبت بدهی جدید"}
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={cancelEditCreate} disabled={saving}>
                انصراف
              </Button>
              <Button onClick={saveDebt} disabled={saving}>
                {mode === "edit" ? "ذخیره تغییرات" : "ثبت بدهی"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <LookupSelect
              label="پروژه"
              value={headerProject}
              onChange={setHeaderProject}
              fetchOptions={fetchProjects}
              display={(opt) => opt?.title || `#${opt?.id}`}
              placeholder="انتخاب پروژه..."
            />

            <LookupSelect
              label="شخص/سازمان"
              value={headerPerson}
              onChange={setHeaderPerson}
              fetchOptions={fetchPersons}
              display={(opt) => personTitle(opt)}
              placeholder="انتخاب..."
              onQuickAdd={() => setQuickAddPersonOpen(true)}
            />

            <Input
              label="تاریخ ثبت"
              type="datetime-local"
              value={dateRegistered}
              onChange={(e) => setDateRegistered(e.target.value)}
            />

            <Input
              label="تاریخ سررسید"
              type="date"
              value={dateDue}
              onChange={(e) => setDateDue(e.target.value)}
            />

            <div className="md:col-span-4">
              <Input
                label="توضیحات"
                value={headerDsc}
                onChange={(e) => setHeaderDsc(e.target.value)}
                placeholder="اختیاری"
              />
            </div>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="mt-4 rounded-2xl border bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Items</div>
          {mode !== "view" ? (
            <Button variant="secondary" onClick={addLine}>
              + افزودن ردیف
            </Button>
          ) : (
            <div className="text-sm text-zinc-600">
              {detailView ? (
                <>
                  جمع: <b>{moneyFa(detailView.totalAmount)}</b> | مانده:{" "}
                  <b>{moneyFa(detailView.remainingAmount)}</b>
                </>
              ) : (
                ""
              )}
            </div>
          )}
        </div>

        {mode === "view" ? (
          loadingDetail ? (
            <div className="text-sm text-zinc-500">در حال بارگذاری...</div>
          ) : !selectedDebtId ? (
            <div className="text-sm text-zinc-500">یک Header انتخاب کنید.</div>
          ) : !detailView ? (
            <div className="text-sm text-zinc-500">جزئیاتی یافت نشد.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-zinc-600">
                  <tr className="border-b">
                    <th className="py-2 text-right">کالا/خدمت</th>
                    <th className="py-2 text-right">واحد</th>
                    <th className="py-2 text-right">تعداد</th>
                    <th className="py-2 text-right">قیمت واحد</th>
                    <th className="py-2 text-right">جمع ردیف</th>
                    <th className="py-2 text-right">توضیحات</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailView.lines || []).length === 0 ? (
                    <tr>
                      <td className="py-3 text-zinc-500" colSpan={6}>
                        ردیفی ندارد
                      </td>
                    </tr>
                  ) : (
                    detailView.lines.map((l) => (
                      <tr key={l.id} className="border-b last:border-b-0">
                        <td className="py-2">{l.itemTitle}</td>
                        <td className="py-2">{l.unitTitle}</td>
                        <td className="py-2">{String(l.qnt)}</td>
                        <td className="py-2">{moneyFa(l.unitPrice)}</td>
                        <td className="py-2 font-semibold">{moneyFa(l.lineTotal)}</td>
                        <td className="py-2">{l.dsc || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-600">
                <tr className="border-b">
                  <th className="py-2 text-right">کالا/خدمت</th>
                  <th className="py-2 text-right">واحد</th>
                  <th className="py-2 text-right">تعداد</th>
                  <th className="py-2 text-right">قیمت واحد</th>
                  <th className="py-2 text-right">جمع ردیف</th>
                  <th className="py-2 text-right">توضیحات</th>
                  <th className="py-2 text-right">+</th>
                  <th className="py-2 text-right">حذف</th>
                </tr>
              </thead>
              <tbody>
                {(editLines || []).length === 0 ? (
                  <tr>
                    <td className="py-3 text-zinc-500" colSpan={8}>
                      هیچ ردیفی اضافه نشده است.
                    </td>
                  </tr>
                ) : (
                  editLines.map((l, idx) => {
                    const lineTotal = Number(l.qnt || 0) * Number(l.unitPrice || 0);

                    return (
                      <tr key={idx} className="border-b last:border-b-0 align-top">
                        <td className="py-2 min-w-[260px]">
                          <LookupSelect
                            label={null}
                            value={l.item}
                            onChange={(opt) => updateLine(idx, { item: opt })}
                            fetchOptions={fetchItems}
                            display={(opt) => opt?.title || `#${opt?.id}`}
                            placeholder="جستجو..."
                          />
                        </td>

                        <td className="py-2 min-w-[220px]">
                          <LookupSelect
                            label={null}
                            value={l.unit}
                            onChange={(opt) => updateLine(idx, { unit: opt })}
                            fetchOptions={fetchUnits}
                            display={(opt) => opt?.title || `#${opt?.id}`}
                            placeholder="جستجو..."
                          />
                        </td>

                        <td className="py-2 min-w-[120px]">
                          <input
                            type="number"
                            className="w-full rounded-xl border border-zinc-200 px-2 py-2"
                            value={l.qnt}
                            onChange={(e) => updateLine(idx, { qnt: e.target.value })}
                            min={0}
                          />
                        </td>

                        <td className="py-2 min-w-[140px]">
                          <input
                            type="number"
                            className="w-full rounded-xl border border-zinc-200 px-2 py-2"
                            value={l.unitPrice}
                            onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                            min={0}
                          />
                        </td>

                        <td className="py-2 min-w-[140px] font-semibold">{moneyFa(lineTotal)}</td>

                        <td className="py-2 min-w-[200px]">
                          <input
                            className="w-full rounded-xl border border-zinc-200 px-2 py-2"
                            value={l.dsc || ""}
                            onChange={(e) => updateLine(idx, { dsc: e.target.value })}
                            placeholder="اختیاری"
                          />
                        </td>

                        <td className="py-2 min-w-[70px]">
                          <Button variant="secondary" onClick={() => insertLineAfter(idx)}>
                            +
                          </Button>
                        </td>

                        <td className="py-2 min-w-[90px]">
                          <Button variant="danger" onClick={() => removeLine(idx)}>
                            حذف
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="mt-3 text-sm">
              <span className="text-zinc-600">جمع کل (تقریبی): </span>
              <span className="font-bold">{moneyFa(editTotal)}</span>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="حذف بدهی"
        message="آیا از حذف این بدهی مطمئن هستید؟ (در صورت داشتن تخصیص/سند، حذف ممکن نیست)"
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />

      <QuickAddPersonModal
        open={quickAddPersonOpen}
        onClose={() => setQuickAddPersonOpen(false)}
        onCreated={(created) => {
          setHeaderPerson(created);
          setQuickAddPersonOpen(false);
        }}
      />
    </>
  );
}
