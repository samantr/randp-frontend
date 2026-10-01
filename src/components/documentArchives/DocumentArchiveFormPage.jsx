import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";
import {
  ArrowRight,
  Download,
  FilePlus,
  FileText,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";
import Input from "../common/Input";
import {
  createDocumentArchive,
  deleteDocumentArchiveDocument,
  downloadDocumentArchiveDocument,
  getDocumentArchive,
  updateDocumentArchive,
  uploadDocumentArchiveDocuments,
} from "../../api/documentArchivesApi";
import {
  DOCUMENT_ARCHIVE_UPLOAD_CONFIG,
  maxFileSizeLabel,
  maxRequestSizeLabel,
} from "../../config/documentArchiveUploadConfig";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const STATUS_LABELS = {
  pending: "در صف ارسال",
  uploading: "در حال ارسال",
  uploaded: "ثبت‌شده",
  failed: "دارای خطا",
};

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

function extensionOf(fileName) {
  const name = String(fileName || "").toLowerCase();
  const index = name.lastIndexOf(".");
  if (index < 0 || index === name.length - 1) return "";
  return name.slice(index + 1);
}

function normalizeContentType(type) {
  return String(type || "").trim().toLowerCase();
}

function fileIdentity(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function validateFile(file) {
  const name = String(file?.name || "").trim();
  if (!name) return "نام فایل معتبر نیست";
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    return "نام فایل شامل مسیر یا عبارت غیرمجاز است";
  }
  if (!file?.size || file.size <= 0) return "حجم فایل باید بیشتر از صفر باشد";
  if (file.size > DOCUMENT_ARCHIVE_UPLOAD_CONFIG.maxFileBytes) {
    return `حداکثر حجم هر فایل ${maxFileSizeLabel()} است`;
  }

  const ext = extensionOf(name);
  if (
    DOCUMENT_ARCHIVE_UPLOAD_CONFIG.allowedExtensions.length > 0 &&
    !DOCUMENT_ARCHIVE_UPLOAD_CONFIG.allowedExtensions.includes(ext)
  ) {
    return "پسوند فایل مجاز نیست";
  }

  const type = normalizeContentType(file.type);
  const isBrowserFallbackType = !type || type === "application/octet-stream";
  if (
    DOCUMENT_ARCHIVE_UPLOAD_CONFIG.allowedContentTypes.length > 0 &&
    !isBrowserFallbackType &&
    !DOCUMENT_ARCHIVE_UPLOAD_CONFIG.allowedContentTypes.includes(type)
  ) {
    return "نوع فایل مجاز نیست";
  }

  return "";
}

function createPendingFile(file, error = "") {
  return {
    clientId: `${fileIdentity(file)}::${Math.random().toString(36).slice(2)}`,
    identity: fileIdentity(file),
    file,
    dsc: "",
    status: error ? "failed" : "pending",
    error,
  };
}

function newForm() {
  return {
    code: "",
    description: "",
    archiveDate: todayIso(),
  };
}

export default function DocumentArchiveFormPage() {
  const navigate = useNavigate();
  const { archiveId } = useParams();
  const isCreate = archiveId === "new" || !archiveId;
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(newForm);
  const [documents, setDocuments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState(null);

  const busy = loading || saving || uploading || !!deletingDocumentId;

  const loadArchive = useCallback(async () => {
    if (isCreate) return;

    setLoading(true);
    try {
      const data = await getDocumentArchive(archiveId);
      setForm({
        code: data?.code || "",
        description: data?.description || "",
        archiveDate: data?.archiveDate || todayIso(),
      });
      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در دریافت بایگانی"));
    } finally {
      setLoading(false);
    }
  }, [archiveId, isCreate]);

  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  useEffect(() => {
    const hasActiveWork = saving || uploading;
    if (!hasActiveWork) return undefined;

    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [saving, uploading]);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setPendingFiles((prev) => {
      const existing = new Set(prev.map((x) => x.identity));
      const next = [...prev];
      let duplicateCount = 0;

      for (const file of files) {
        const identity = fileIdentity(file);
        if (existing.has(identity)) {
          duplicateCount += 1;
          continue;
        }

        existing.add(identity);
        next.push(createPendingFile(file, validateFile(file)));
      }

      if (duplicateCount) {
        toast.error(`${duplicateCount.toLocaleString("fa-IR")} فایل تکراری اضافه نشد`);
      }

      return next;
    });

    resetFileInput();
  }

  function removePending(clientId) {
    setPendingFiles((prev) => prev.filter((x) => x.clientId !== clientId));
  }

  function clearPending() {
    setPendingFiles([]);
    resetFileInput();
  }

  function updatePendingDescription(clientId, value) {
    setPendingFiles((prev) =>
      prev.map((x) => (x.clientId === clientId ? { ...x, dsc: value } : x)),
    );
  }

  function validateHeader() {
    if (!form.description.trim()) {
      toast.error("شرح بایگانی الزامی است");
      return false;
    }
    if (!form.archiveDate) {
      toast.error("تاریخ بایگانی الزامی است");
      return false;
    }
    return true;
  }

  function validPendingFiles({ requireFiles }) {
    if (requireFiles && !pendingFiles.length) {
      toast.error("برای ایجاد بایگانی حداقل یک سند انتخاب کنید");
      return null;
    }

    if (!pendingFiles.length) return [];

    const invalid = pendingFiles.find((x) => x.error || x.status === "failed");
    if (invalid) {
      toast.error(invalid.error || "برخی فایل‌های انتخاب‌شده معتبر نیستند");
      return null;
    }

    const totalBytes = pendingFiles.reduce((sum, x) => sum + Number(x.file?.size || 0), 0);
    if (totalBytes > DOCUMENT_ARCHIVE_UPLOAD_CONFIG.maxRequestBytes) {
      toast.error(`حداکثر حجم مجموع فایل‌ها ${maxRequestSizeLabel()} است`);
      return null;
    }

    return pendingFiles;
  }

  function markPendingStatus(status, error = "") {
    setPendingFiles((prev) => prev.map((x) => ({ ...x, status, error })));
  }

  async function saveHeader({ backToList = false } = {}) {
    if (!validateHeader()) return;

    if (isCreate) {
      const files = validPendingFiles({ requireFiles: true });
      if (!files) return;

      setSaving(true);
      setUploadProgress(0);
      markPendingStatus("uploading");
      try {
        const created = await createDocumentArchive({
          description: form.description.trim(),
          archiveDate: form.archiveDate,
          files: files.map((x) => x.file),
          documentDescriptions: files.map((x) => x.dsc),
          onUploadProgress: (event) => {
            if (!event.total) return;
            setUploadProgress(Math.round((event.loaded * 100) / event.total));
          },
        });

        toast.success("بایگانی ایجاد شد");
        setPendingFiles([]);
        setDocuments(Array.isArray(created?.documents) ? created.documents : []);
        setForm({
          code: created?.code || "",
          description: created?.description || form.description,
          archiveDate: created?.archiveDate || form.archiveDate,
        });

        if (backToList) {
          navigate("/document-archives");
        } else {
          navigate(`/document-archives/${created.id}`, { replace: true });
        }
      } catch (e) {
        // The files themselves are still valid; return them to the pending state so retry works.
        markPendingStatus("pending");
        toast.error(getApiErrorMessage(e, "خطا در ایجاد بایگانی"));
      } finally {
        setSaving(false);
        setUploadProgress(0);
      }
      return;
    }

    setSaving(true);
    try {
      const updated = await updateDocumentArchive(archiveId, {
        description: form.description.trim(),
        archiveDate: form.archiveDate,
      });
      toast.success("اطلاعات بایگانی ذخیره شد");
      setForm({
        code: updated?.code || form.code,
        description: updated?.description || form.description,
        archiveDate: updated?.archiveDate || form.archiveDate,
      });
      setDocuments(Array.isArray(updated?.documents) ? updated.documents : documents);

      if (backToList) navigate("/document-archives");
      if (!backToList && pendingFiles.length) {
        toast("برای ارسال فایل‌های انتخاب‌شده از دکمه افزودن اسناد استفاده کنید");
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در ذخیره بایگانی"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadPendingFiles() {
    if (isCreate) return;

    const files = validPendingFiles({ requireFiles: true });
    if (!files) return;

    setUploading(true);
    setUploadProgress(0);
    markPendingStatus("uploading");
    try {
      const updated = await uploadDocumentArchiveDocuments(archiveId, {
        files: files.map((x) => x.file),
        documentDescriptions: files.map((x) => x.dsc),
        onUploadProgress: (event) => {
          if (!event.total) return;
          setUploadProgress(Math.round((event.loaded * 100) / event.total));
        },
      });

      toast.success("اسناد اضافه شدند");
      setPendingFiles([]);
      setDocuments(Array.isArray(updated?.documents) ? updated.documents : []);
      setForm({
        code: updated?.code || form.code,
        description: updated?.description || form.description,
        archiveDate: updated?.archiveDate || form.archiveDate,
      });
    } catch (e) {
      // The files themselves are still valid; return them to the pending state so retry works.
      markPendingStatus("pending");
      toast.error(getApiErrorMessage(e, "خطا در ارسال اسناد"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function deleteSavedDocument() {
    if (!deleteTarget || isCreate) return;

    setDeletingDocumentId(deleteTarget.id);
    try {
      await deleteDocumentArchiveDocument(archiveId, deleteTarget.id);
      toast.success("سند حذف شد");
      setDeleteTarget(null);
      await loadArchive();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در حذف سند"));
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function downloadSavedDocument(row) {
    if (!row?.id || isCreate) return;

    setDownloadingDocumentId(row.id);
    try {
      const res = await downloadDocumentArchiveDocument(archiveId, row.id);
      const headerName = extractFilenameFromHeader(res.headers?.["content-disposition"]);
      const name = headerName || row.originalFileName || `document_${row.id}`;
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در دانلود سند"));
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  const savedRows = useMemo(
    () =>
      (documents || []).map((doc) => ({
        kind: "saved",
        key: `saved-${doc.id}`,
        id: doc.id,
        fileName: doc.originalFileName,
        contentType: doc.contentType,
        fileSize: doc.fileSize,
        dsc: doc.dsc,
        createdAt: doc.createdAt,
        displayOrder: doc.displayOrder,
        status: "uploaded",
      })),
    [documents],
  );

  const pendingRows = useMemo(
    () =>
      pendingFiles.map((item) => ({
        kind: "pending",
        key: `pending-${item.clientId}`,
        clientId: item.clientId,
        fileName: item.file.name,
        contentType: item.file.type || "-",
        fileSize: item.file.size,
        dsc: item.dsc,
        status: item.status,
        error: item.error,
      })),
    [pendingFiles],
  );

  const allRows = useMemo(() => [...savedRows, ...pendingRows], [savedRows, pendingRows]);

  const dropHandlers = {
    onDragOver: (event) => {
      event.preventDefault();
      if (!busy) setDragOver(true);
    },
    onDragLeave: (event) => {
      event.preventDefault();
      setDragOver(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setDragOver(false);
      if (!busy) addFiles(event.dataTransfer?.files);
    },
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xl font-bold">
            <FileText size={22} />
            {isCreate ? "ایجاد بایگانی سند" : "ویرایش بایگانی سند"}
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            {isCreate
              ? "کد بایگانی پس از ثبت توسط سرور ایجاد می‌شود"
              : `کد بایگانی: ${form.code || "-"}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate("/document-archives")} disabled={busy}>
            <ArrowRight size={16} />
            بازگشت
          </Button>
          <Button variant="secondary" onClick={() => saveHeader({ backToList: true })} disabled={busy}>
            <Save size={16} />
            ذخیره و بازگشت
          </Button>
          <Button onClick={() => saveHeader()} disabled={busy}>
            <Save size={16} />
            {isCreate ? "ایجاد بایگانی" : "ذخیره"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            label="کد بایگانی"
            value={form.code || "پس از ثبت ایجاد می‌شود"}
            readOnly
            className="bg-zinc-50 text-zinc-500"
          />

          <div>
            <div className="mb-1 text-sm text-zinc-700">تاریخ بایگانی</div>
            <DatePicker
              value={isoToPersianDateObject(form.archiveDate)}
              onChange={(value) => updateForm("archiveDate", persianValueToIso(value))}
              calendar={persian}
              locale={persian_fa}
              format="YYYY/MM/DD"
              calendarPosition="bottom-right"
              inputClass="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
              containerClassName="rtl w-full"
              disabled={busy}
            />
            <div className="mt-1 text-xs text-zinc-500">{isoToJalaliText(form.archiveDate)}</div>
          </div>

          <div className="text-xs text-zinc-500 md:flex md:items-end">
            {isCreate
              ? "ایجاد بایگانی در نسخه فعلی بک‌اند بدون انتخاب سند مجاز نیست."
              : "در این صفحه فقط شرح، تاریخ و اسناد بایگانی مدیریت می‌شود."}
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-sm text-zinc-700">شرح بایگانی</div>
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              disabled={busy}
              rows={4}
              className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
              placeholder="شرح بایگانی را وارد کنید"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">اسناد بایگانی</div>
            <div className="mt-1 text-xs text-zinc-500">
              همه نوع فایل، از جمله فایل‌های DWG، قابل بایگانی است.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <FilePlus size={16} />
              انتخاب فایل
            </Button>
            <Button variant="secondary" onClick={clearPending} disabled={busy || !pendingFiles.length}>
              <X size={16} />
              پاک کردن صف
            </Button>
            {!isCreate ? (
              <Button onClick={uploadPendingFiles} disabled={busy || !pendingFiles.length}>
                <Upload size={16} />
                افزودن اسناد
              </Button>
            ) : null}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => addFiles(event.target.files)}
        />

        <div
          className={`mt-4 rounded-2xl border-2 border-dashed p-5 text-center text-sm ${
            dragOver ? "border-zinc-500 bg-zinc-50" : "border-zinc-200"
          }`}
          {...dropHandlers}
        >
          <div className="font-medium">فایل‌ها را اینجا رها کنید یا از دکمه انتخاب فایل استفاده کنید</div>
          <div className="mt-1 text-xs text-zinc-500">
            حداکثر حجم هر فایل {maxFileSizeLabel()} و مجموع هر ارسال {maxRequestSizeLabel()} است.
          </div>
          {uploadProgress > 0 ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-black transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 font-semibold">لیست اسناد</div>

        {loading ? (
          <div className="text-sm text-zinc-500">در حال بارگذاری...</div>
        ) : allRows.length === 0 ? (
          <div className="text-sm text-zinc-500">هنوز سندی انتخاب یا ثبت نشده است.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="sticky top-0 bg-white text-zinc-600">
                <tr className="border-b">
                  <th className="py-2 text-right">ردیف</th>
                  <th className="py-2 text-right">نام فایل</th>
                  <th className="py-2 text-right">نوع</th>
                  <th className="py-2 text-right">حجم</th>
                  <th className="py-2 text-right">توضیحات سند</th>
                  <th className="py-2 text-right">وضعیت</th>
                  <th className="py-2 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, index) => (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className="py-2">{(index + 1).toLocaleString("fa-IR")}</td>
                    <td className="py-2 font-semibold">
                      <span className="block max-w-[260px] truncate" title={row.fileName || ""}>
                        {row.fileName || "-"}
                      </span>
                    </td>
                    <td className="py-2">{row.contentType || "-"}</td>
                    <td className="py-2">{bytesLabel(row.fileSize)}</td>
                    <td className="py-2">
                      {row.kind === "pending" ? (
                        <Input
                          value={row.dsc}
                          onChange={(event) =>
                            updatePendingDescription(row.clientId, event.target.value)
                          }
                          disabled={busy}
                          placeholder="اختیاری"
                        />
                      ) : (
                        row.dsc || "-"
                      )}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs ${
                          row.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : row.status === "uploaded"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-zinc-100 text-zinc-700"
                        }`}
                        title={row.error || ""}
                      >
                        {row.error || STATUS_LABELS[row.status] || "-"}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {row.kind === "saved" ? (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() => downloadSavedDocument(row)}
                              disabled={busy || downloadingDocumentId === row.id}
                            >
                              <Download size={16} />
                              دانلود
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => setDeleteTarget(row)}
                              disabled={busy}
                            >
                              <Trash2 size={16} />
                              حذف
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => removePending(row.clientId)}
                            disabled={busy}
                          >
                            <X size={16} />
                            حذف از صف
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف سند"
        message="آیا از حذف این سند مطمئن هستید؟ فایل ذخیره‌شده نیز حذف خواهد شد."
        onCancel={() => {
          if (!deletingDocumentId) setDeleteTarget(null);
        }}
        onConfirm={deleteSavedDocument}
      />
    </div>
  );
}
