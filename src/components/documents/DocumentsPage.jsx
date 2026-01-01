import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "../common/Button";
import Input from "../common/Input";
import ConfirmDialog from "../common/ConfirmDialog";

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
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
  if (!m) return null;
  return decodeURIComponent(m[1] || m[2] || "").trim() || null;
}

function safeStr(s) {
  if (s == null) return "";
  return String(s);
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
  const params = useParams();
  const cfg = useMemo(() => getOwnerConfig(ownerType), [ownerType]);
  const ownerId = Number(params[cfg.paramKey]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [file, setFile] = useState(null);
  const [dsc, setDsc] = useState("");
  const [uploading, setUploading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Preview modal
  const [preview, setPreview] = useState(null); // { url, type, title }
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

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const data = await cfg.list(ownerId);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error("خطا در دریافت لیست پیوست‌ها");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [cfg, ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  const onUpload = useCallback(async () => {
    if (!ownerId) return;

    if (!file) {
      toast.error("لطفاً فایل را انتخاب کنید");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`حداکثر حجم فایل ${MAX_FILE_MB} مگابایت است.`);
      return;
    }

    setUploading(true);
    try {
      await cfg.upload(ownerId, { file, dsc });
      toast.success("پیوست اضافه شد");
      clearSelectedFile();
      setDsc("");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "خطا در آپلود فایل");
    } finally {
      setUploading(false);
    }
  }, [cfg, ownerId, file, dsc, load, clearSelectedFile]);

  const onDownload = useCallback(
    async (docId, fallbackName) => {
      try {
        const res = await cfg.download(docId);
        const blob = res.data;
        const headerName = extractFilenameFromHeader(res.headers?.["content-disposition"]);
        const name = headerName || fallbackName || `document_${docId}`;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch {
        toast.error("خطا در دانلود فایل");
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

        if (!type) {
          toast.error("پیش‌نمایش برای این نوع فایل فعال نیست");
          return;
        }

        const url = window.URL.createObjectURL(blob);
        previewUrlRef.current = url;

        setPreview({
          url,
          type,
          title: fileName,
        });
      } catch {
        toast.error("خطا در دریافت فایل برای پیش‌نمایش");
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
      toast.error(e?.response?.data?.message || "خطا در حذف پیوست");
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

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{cfg.title}</h1>
          <div className="text-xs text-zinc-600">شناسه: {ownerId}</div>
        </div>
        <Button variant="secondary" onClick={() => navigate(cfg.backTo)}>
          بازگشت
        </Button>
      </div>

      {/* upload box */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 font-semibold">افزودن پیوست</div>

        <div
          className={`rounded-2xl border p-3 transition ${
            dragOver ? "border-zinc-800 bg-zinc-50" : "border-zinc-200"
          }`}
          {...dropHandlers}
        >
          {/* Grid aligned */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
            {/* File column */}
            <div className="md:col-span-4">
              <div className="mb-1 text-xs text-zinc-600">فایل</div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  onChange={(e) => validateAndSetFile(e.target.files?.[0] || null)}
                />
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  انتخاب
                </Button>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {file ? (
                  <span>
                    انتخاب شد: <span className="font-semibold">{file.name}</span> ({bytesLabel(file.size)})
                    <button
                      type="button"
                      className="mr-2 underline"
                      onClick={clearSelectedFile}
                    >
                      پاک کردن
                    </button>
                  </span>
                ) : (
                  <span>می‌توانید فایل را Drag & Drop کنید (حداکثر {MAX_FILE_MB}MB)</span>
                )}
              </div>
            </div>
                
            {/* Description column */}
            <div className="md:col-span-6">
              <Input
                label="توضیحات (اختیاری)"
                value={dsc}
                onChange={(e) => setDsc(e.target.value)}
                placeholder="مثلاً فاکتور خرید..."
              />
            </div>

            {/* Button column */}
            <div className="md:col-span-2">
              <Button className="w-full" onClick={onUpload} disabled={uploading}>
                {uploading ? "در حال آپلود..." : "آپلود"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* list */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">لیست پیوست‌ها</div>
          <div className="text-xs text-zinc-600">{loading ? "در حال بارگذاری..." : `${rows.length} مورد`}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 text-right">
                <th className="p-2">ID</th>
                <th className="p-2">نام فایل</th>
                <th className="p-2">نوع</th>
                <th className="p-2">حجم</th>
                <th className="p-2">تاریخ</th>
                <th className="p-2">توضیحات</th>
                <th className="p-2">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const fileName = r.fileName || `document_${r.id}`;
                const previewType = canPreview(r.contentType, fileName);

                return (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{r.id}</td>
                    <td className="p-2 font-semibold">{fileName}</td>
                    <td className="p-2">{r.contentType || "-"}</td>
                    <td className="p-2">{bytesLabel(r.sizeBytes)}</td>
                    <td className="p-2">{r.createdAt || "-"}</td>
                    <td className="p-2">{r.dsc || "-"}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => onDownload(r.id, fileName)}>
                          دانلود
                        </Button>

                        {previewType && (
                          <Button variant="secondary" onClick={() => onOpenPreview(r)}>
                            پیش‌نمایش
                          </Button>
                        )}

                        <Button variant="danger" onClick={() => setDeleteTarget({ id: r.id, fileName })}>
                          حذف
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-500">
                    هیچ پیوستی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف پیوست"
        message={`آیا از حذف این پیوست مطمئن هستید؟\n${deleteTarget?.fileName || ""}`}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* preview modal (simple) */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={cleanupPreview}>
          <div
            className="w-full max-w-5xl rounded-2xl bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">{preview.title}</div>
              <Button variant="secondary" onClick={cleanupPreview}>
                بستن
              </Button>
            </div>

            <div className="h-[75vh] w-full overflow-hidden rounded-xl border bg-zinc-50">
              {preview.type === "image" ? (
                <img
                  src={preview.url}
                  alt={preview.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <iframe
                  title={preview.title}
                  src={preview.url}
                  className="h-full w-full"
                />
              )}
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              اگر فایل بزرگ است، ممکن است باز شدن پیش‌نمایش کمی طول بکشد.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
