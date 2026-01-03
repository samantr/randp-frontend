import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import LookupSelect from "../lookup/LookupSelect";
import { normalizeFaText } from "../../utils/normalizeFa";
import { getProjects, updateProject } from "../../api/projectsApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

export default function EditProjectModal({
  open,
  project,
  loading,
  onClose,
  onUpdated,
}) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [dsc, setDsc] = useState("");
  const [parent, setParent] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTitle(project?.title || "");
    setCode(project?.code || "");
    setDsc(project?.dsc || "");
    setParent(
      project?.parentId ? { id: project.parentId, title: `#${project.parentId}` } : null
    );
  }, [open, project]);

  async function fetchParents({ q }) {
    try {
      const res = await getProjects();
      const all = Array.isArray(res) ? res : [];
      const selfId = project?.id;

      const candidates = all.filter((p) => p?.id !== selfId);

      const nq = normalizeFaText(q || "");
      const filtered = !nq
        ? candidates
        : candidates.filter((p) => {
            const t = normalizeFaText(p?.title || "");
            const c = normalizeFaText(p?.code || "");
            return t.includes(nq) || c.includes(nq);
          });

      return filtered.sort((a, b) =>
        (a?.title || "").localeCompare(b?.title || "")
      );
    } catch {
      return [];
    }
  }

  const canSubmit = useMemo(() => !loading && !!project?.id, [loading, project]);

  async function handleUpdate() {
    if (!project?.id) return;

    const payload = {
      title: title?.trim(),
      code: code?.trim() || null,
      dsc: dsc?.trim() || null,
      parentId: parent?.id || null,
    };

    if (!payload.title) {
      toast.error(getApiErrorMessage(e, "عنوان پروژه را وارد کنید"));
      return;
    }

    if (payload.parentId && payload.parentId === project.id) {
      toast.error(getApiErrorMessage(e, "پروژه پدر نمی‌تواند خود پروژه باشد"));
      return;
    }

    try {
      const updated = await updateProject(project.id, payload);
      toast.success("ویرایش شد");
      onUpdated?.(updated);
      onClose?.();
    } catch(e) {
      toast.error(getApiErrorMessage(e, "خطا در ویرایش پروژه"));
    }
  }

  return (
    <Modal
      open={open}
      title="ویرایش پروژه"
      onClose={onClose}
      footer={
        <div className="flex gap-2 justify-start">
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleUpdate} disabled={!canSubmit}>
            ذخیره
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="text-sm text-zinc-500">در حال بارگذاری...</div>
      ) : !project ? (
        <div className="text-sm text-zinc-500">موردی انتخاب نشده است</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="عنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="کد (اختیاری)" value={code} onChange={(e) => setCode(e.target.value)} />

          <LookupSelect
            label="پروژه پدر (اختیاری)"
            value={parent?.id ? parent : null}
            onChange={setParent}
            fetchOptions={fetchParents}
            display={(p) => {
              const id = p?.id ?? "";
              const t = p?.title ?? "";
              const c = p?.code ?? "";
              return c ? `${c} - ${t}` : `${id} - ${t}`;
            }}
            placeholder="بدون پدر (ریشه)"
          />

          <div className="md:col-span-2">
            <Input label="توضیحات (اختیاری)" value={dsc} onChange={(e) => setDsc(e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
