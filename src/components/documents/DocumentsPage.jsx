import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "../common/Button.jsx";
import Input from "../common/Input.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import Modal from "../common/Modal.jsx";

import {
  listDebtDocuments,
  uploadDebtDocument,
  deleteDebtDocument,
  downloadDebtDocument,
  listTransactionDocuments,
  uploadTransactionDocument,
  deleteTransactionDocument,
  downloadTransactionDocument,
} from "../../api/documentsApi";

import { getDebtView } from "../../api/debtsApi";
import { getTransactionById } from "../../api/transactionsApi";
import { getPersons } from "../../api/personsApi";
import { getProjects } from "../../api/projectsApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

function bytesLabel(n) {
  const b = Number(n || 0);
  if (!b) return "0";
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function extractFilenameFromHeader(contentDisposition) {
  if (!contentDisposition) return null;
  const m =
    /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
  if (!m) return null;
  return decodeURIComponent(m[1] || m[2] || "").trim() || null;
}

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

function dateFa(v) {
  if (!v) return "-";
  return String(v).replace("T", " ").substring(0, 16);
}

function getOwnerConfig(ownerType) {
  if (ownerType === "debt") {
    return {
      title: "پیوست‌های بدهی",
      backTo: "/debts",
      paramKey: "debtId",
      list: listDebtDocuments,
      upload: uploadDebtDocument,
      del: deleteDebtDocument,
      download: downloadDebtDocument,
    };
  }
  return {
    title: "پیوست‌های تراکنش",
    backTo: "/transactions",
    paramKey: "transactionId",
    list: listTransactionDocuments,
    upload: uploadTransactionDocument,
    del: deleteTransactionDocument,
    download: downloadTransactionDocument,
  };
}

function canPreview(mime, filename) {
  const t = (mime || "").toLowerCase();
  const fn = (filename || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf" || fn.endsWith(".pdf")) return "pdf";
  return null;
}

export default function DocumentsPage({ ownerType }) {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const params = useParams();

  const returnTo = sp.get("return"); // encoded list URL

  const cfg = useMemo(() => getOwnerConfig(ownerType), [ownerType]);
  const ownerId = Number(params[cfg.paramKey]);

  // ✅ FIX: if return is not provided, go back in history (preserves filters/sort on list page)
  const onBack = () => {
    if (returnTo) {
      try {
        navigate(decodeURIComponent(returnTo));
        return;
      } catch {
        // if decoding failed, fall back to history
      }
    }

    // Prefer history back (works like allocations page)
    navigate(-1);
  };

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  // Header details
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [personsMap, setPersonsMap] = useState({});
  const [projectsMap, setProjectsMap] = useState({});
  const [headerLoading, setHeaderLoading] = useState(false);
  const [debtView, setDebtView] = useState(null);
  const [tx, setTx] = useState(null);

  // upload
  const [file, setFile] = useState(null);
  const [dsc, setDsc] = useState("");
  const [uploading, setUploading] = useState(false);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Preview modal
  const [preview, setPreview] = useState(null); // {url,type,title}
  const previewUrlRef = useRef(null);

  const cleanupPreview = useCallback(() => {
    if (previewUrlRef.current) {
      try {
        window.URL.revokeObjectURL(previewUrlRef.current);
      } catch {}
      previewUrlRef.current = null;
    }
    setPreview(null);
  }, []);

  const validateAndSetFile = useCallback((f) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`حداکثر حجم فایل ${MAX_FILE_MB} مگابایت است.`);
      return;
    }
    setFile(f);
  }, []);

  const clearSelectedFile = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    try {
      const personsRes = await getPersons({ page: 0, size: 5000, q: "" });
      const persons = normalizePageLike(personsRes).content || [];
      const pm = {};
      for (const p of persons) pm[p.id] = personLabel(p);
      setPersonsMap(pm);
    } catch {
      setPersonsMap({});
    }

    try {
      const projectsRes = await getProjects({ page: 0, size: 5000, q: "" });
      const projects =
        normalizePageLike(projectsRes).content || projectsRes || [];
      const pr = {};
      for (const p of projects) pr[p.id] = p.title || `#${p.id}`;
      setProjectsMap(pr);
    } catch {
      setProjectsMap({});
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  const loadHeader = useCallback(async () => {
    if (!ownerId) return;
    setHeaderLoading(true);
    try {
      if (ownerType === "debt") {
        const v = await getDebtView(ownerId);
        setDebtView(v || null);
        setTx(null);
      } else {
        const t = await getTransactionById(ownerId);
        setTx(t || null);
        setDebtView(null);
      }
    } catch (e) {
      toast.error(
        getApiErrorMessage(
          e,
          ownerType === "debt"
            ? "خطا در دریافت اطلاعات بدهی"
            : "خطا در دریافت اطلاعات تراکنش"
        )
      );
      setDebtView(null);
      setTx(null);
    } finally {
      setHeaderLoading(false);
    }
  }, [ownerId, ownerType]);

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const data = await cfg.list(ownerId);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در دریافت لیست پیوست‌ها"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [cfg, ownerId]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadHeader();
  }, [loadHeader]);

  useEffect(() => {
    load();
  }, [load]);

  const onUpload = useCallback(async () => {
    if (!ownerId) return;

    if (!file) return toast.error("لطفاً فایل را انتخاب کنید");
    if (file.size > MAX_FILE_BYTES)
      return toast.error(`حداکثر حجم فایل ${MAX_FILE_MB} مگابایت است.`);

    setUploading(true);
    try {
      await cfg.upload(ownerId, { file, dsc });
      toast.success("پیوست اضافه شد");
      clearSelectedFile();
      setDsc("");
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در آپلود فایل"));
    } finally {
      setUploading(false);
    }
  }, [cfg, ownerId, file, dsc, load, clearSelectedFile]);

  const onDownload = useCallback(
    async (docId, fallbackName) => {
      try {
        const res = await cfg.download(docId);
        const blob = res.data;
        const headerName = extractFilenameFromHeader(
          res.headers?.["content-disposition"]
        );
        const name = headerName || fallbackName || `document_${docId}`;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        toast.error(getApiErrorMessage(e, "خطا در دانلود فایل"));
      }
    },
    [cfg]
  );

  const onOpenPreview = useCallback(
    async (row) => {
      cleanupPreview();
      try {
        const res = await cfg.download(row.id);
        const blob = res.data;

        const cd = res.headers?.["content-disposition"];
        const headerName = extractFilenameFromHeader(cd);

        const fileName = headerName || row.fileName || `document_${row.id}`;
        const mime = row.contentType || blob.type || "";
        const type = canPreview(mime, fileName);

        if (!type) return toast.error("پیش‌نمایش برای این نوع فایل فعال نیست");

        const url = window.URL.createObjectURL(blob);
        previewUrlRef.current = url;

        setPreview({ url, type, title: fileName });
      } catch (e) {
        toast.error(getApiErrorMessage(e, "خطا در دریافت فایل برای پیش‌نمایش"));
      }
    },
    [cfg, cleanupPreview]
  );

  const onDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await cfg.del(ownerId, deleteTarget.id);
      toast.success("پیوست حذف شد");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در حذف پیوست"));
    }
  }, [cfg, deleteTarget, load, ownerId]);

  const dropHandlers = {
    onDragOver: (e) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: (e) => {
      e.preventDefault();
      setDragOver(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer?.files?.[0];
      validateAndSetFile(f);
    },
  };

  const debtHeader = debtView?.header || null;

  const headerBox = useMemo(() => {
    if (ownerType === "debt") {
      if (!debtHeader) return null;

      const projectTitle = debtHeader.projectId
        ? projectsMap[debtHeader.projectId] || `#${debtHeader.projectId}`
        : "-";
      const personName = debtHeader.personId
        ? personsMap[debtHeader.personId] || `#${debtHeader.personId}`
        : "-";

      return (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-3 text-sm">
          <div>
            <span className="text-zinc-600">پروژه:</span>{" "}
            <b>{projectTitle}</b>
          </div>
          <div>
            <span className="text-zinc-600">شخص/سازمان:</span>{" "}
            <b>{personName}</b>
          </div>
          <div>
            <span className="text-zinc-600">تاریخ ثبت:</span>{" "}
            <b>{dateFa(debtHeader.dateRegistered)}</b>
          </div>
          <div>
            <span className="text-zinc-600">سررسید:</span>{" "}
            <b>{String(debtHeader.dateDue || "-")}</b>
          </div>

          <div className="md:col-span-2">
            <span className="text-zinc-600">توضیحات:</span>{" "}
            <b>{debtHeader.dsc || "-"}</b>
          </div>

          <div className="md:col-span-2 border-t pt-2">
            <span className="text-zinc-600">جمع:</span>{" "}
            <b>{moneyFa(debtView?.totalAmount)}</b>{" "}
            <span className="text-zinc-400">|</span>{" "}
            <span className="text-zinc-600">تخصیص:</span>{" "}
            <b>{moneyFa(debtView?.coveredAmount)}</b>{" "}
            <span className="text-zinc-400">|</span>{" "}
            <span className="text-zinc-600">مانده:</span>{" "}
            <b className="text-emerald-700">
              {moneyFa(debtView?.remainingAmount)}
            </b>
          </div>
        </div>
      );
    }

    // transaction header
    if (!tx) return null;

    const projectTitle = tx.projectId
      ? projectsMap[tx.projectId] || `#${tx.projectId}`
      : "-";
    const personName = tx.personId
      ? personsMap[tx.personId] || `#${tx.personId}`
      : "-";

    return (
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-3 text-sm">
        <div>
          <span className="text-zinc-600">کد:</span>{" "}
          <b>{tx.code || `#${tx.id}`}</b>
        </div>
        <div>
          <span className="text-zinc-600">تاریخ ثبت:</span>{" "}
          <b>{dateFa(tx.dateRegistered)}</b>
        </div>
        <div>
          <span className="text-zinc-600">پروژه:</span>{" "}
          <b>{projectTitle}</b>
        </div>
        <div>
          <span className="text-zinc-600">شخص/سازمان:</span>{" "}
          <b>{personName}</b>
        </div>

        <div>
          <span className="text-zinc-600">نوع:</span>{" "}
          <b>{transactionTypeLabel(tx.transactionType)}</b>
        </div>
        <div>
          <span className="text-zinc-600">روش پرداخت:</span>{" "}
          <b>{paymentTypeLabel(tx.paymentType)}</b>
        </div>

        <div>
          <span className="text-zinc-600">مبلغ:</span>{" "}
          <b>{moneyFa(tx.amountPaid)}</b>
        </div>
        <div>
          <span className="text-zinc-600">توضیحات:</span>{" "}
          <b>{tx.dsc || "-"}</b>
        </div>
      </div>
    );
  }, [ownerType, debtHeader, debtView, tx, personsMap, projectsMap]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{cfg.title}</h1>
            <div className="text-xs text-zinc-600">
              {ownerType === "debt" ? "شناسه بدهی" : "شناسه تراکنش"}: {ownerId}
            </div>
          </div>
          <Button variant="secondary" onClick={onBack}>
            بازگشت
          </Button>
        </div>

        {lookupsLoading || headerLoading ? (
          <div className="text-sm text-zinc-500 mt-3">
            در حال بارگذاری اطلاعات...
          </div>
        ) : (
          headerBox
        )}
      </div>

      {/* Upload */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="font-semibold mb-2">افزودن پیوست</div>

        <div
          className={`rounded-2xl border-2 border-dashed p-4 ${
            dragOver ? "border-zinc-400 bg-zinc-50" : "border-zinc-200"
          }`}
          {...dropHandlers}
        >
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="block w-full text-sm"
              onChange={(e) => validateAndSetFile(e.target.files?.[0])}
            />

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={clearSelectedFile}
                disabled={!file}
              >
                پاک
              </Button>
              <Button onClick={onUpload} disabled={uploading || !file}>
                {uploading ? "در حال آپلود..." : "آپلود"}
              </Button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="توضیحات"
              value={dsc}
              onChange={(e) => setDsc(e.target.value)}
              placeholder="اختیاری"
            />
            <div className="md:col-span-2 text-xs text-zinc-500 flex items-end">
              {file ? (
                <>
                  فایل انتخاب شده: <b className="mx-1">{file.name}</b> (
                  {bytesLabel(file.size)})
                </>
              ) : (
                <>
                  حداکثر حجم فایل: {MAX_FILE_MB}MB — همچنین می‌توانید Drag &
                  Drop کنید.
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="font-semibold mb-2">لیست پیوست‌ها</div>

        {loading ? (
          <div className="text-sm text-zinc-500">در حال بارگذاری...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-zinc-500">پیوستی ثبت نشده است.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-600">
                <tr className="border-b">
                  <th className="py-2 text-right">نام فایل</th>
                  <th className="py-2 text-right">نوع</th>
                  <th className="py-2 text-right">حجم</th>
                  <th className="py-2 text-right">توضیحات</th>
                  <th className="py-2 text-right">عملیات</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const type = canPreview(r.contentType, r.fileName);
                  return (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 font-semibold">
                        {r.fileName || `#${r.id}`}
                      </td>
                      <td className="py-2">{r.contentType || "-"}</td>
                      <td className="py-2">{bytesLabel(r.fileSize)}</td>
                      <td className="py-2">{r.dsc || "-"}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          {type ? (
                            <Button
                              variant="secondary"
                              onClick={() => onOpenPreview(r)}
                            >
                              پیش‌نمایش
                            </Button>
                          ) : null}

                          <Button
                            variant="secondary"
                            onClick={() => onDownload(r.id, r.fileName)}
                          >
                            دانلود
                          </Button>

                          <Button
                            variant="danger"
                            onClick={() => setDeleteTarget(r)}
                          >
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف پیوست"
        message="آیا از حذف این پیوست مطمئن هستید؟"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={onDelete}
      />

      <Modal
        open={!!preview}
        title={preview?.title || "پیش‌نمایش"}
        onClose={cleanupPreview}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={cleanupPreview}>
              بستن
            </Button>
          </div>
        }
      >
        {!preview ? null : preview.type === "image" ? (
          <img
            src={preview.url}
            alt={preview.title}
            className="max-h-[75vh] w-full object-contain rounded-xl"
          />
        ) : (
          <iframe
            title="pdf"
            src={preview.url}
            className="w-full h-[75vh] rounded-xl border"
          />
        )}
      </Modal>
    </div>
  );
}
