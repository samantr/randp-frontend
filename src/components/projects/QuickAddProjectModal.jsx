import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import LookupSelect from "../lookup/LookupSelect";
import { normalizeFaText } from "../../utils/normalizeFa";
import { createProject, getProjects } from "../../api/projectsApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

export default function QuickAddProjectModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [dsc, setDsc] = useState("");
  const [parent, setParent] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCode("");
    setDsc("");
    setParent(null);
  }, [open]);

  async function fetchParents({ q }) {
    try {
      const res = await getProjects();
      const all = Array.isArray(res) ? res : [];

      const nq = normalizeFaText(q || "");
      const filtered = !nq
        ? all
        : all.filter((p) => {
            const t = normalizeFaText(p?.title || "");
            const c = normalizeFaText(p?.code || "");
            return t.includes(nq) || c.includes(nq);
          });

      return filtered.sort((a, b) =>
        (a?.title || "").localeCompare(b?.title || "")
      );
    } catch (e) {
      // no crash
      return [];
    }
  }

  async function handleCreate() {
    const payload = {
      title: title?.trim(),
      code: code?.trim() || null,
      dsc: dsc?.trim() || null,
      parentId: parent?.id || null,
    };

    if (!payload.title) {
      toast.error("عنوان پروژه را وارد کنید");
      return;
    }

    try {
      const created = await createProject(payload);
      toast.success("پروژه ثبت شد");
      onCreated?.(created);
      onClose?.();
    } catch(e) {
      toast.error(getApiErrorMessage(e, "خطا در ثبت پروژه"));
    }
  }

  return (
    <Modal
      open={open}
      title="افزودن پروژه"
      onClose={onClose}
      footer={
        <div className="flex gap-2 justify-start">
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleCreate}>ثبت</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="عنوان"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثلاً پروژه ساختمان بهنام"
        />

        <Input
          label="کد (اختیاری)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="مثلاً PRJ-01"
        />

        <LookupSelect
          label="پروژه پدر (اختیاری)"
          value={parent}
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
          <Input
            label="توضیحات (اختیاری)"
            value={dsc}
            onChange={(e) => setDsc(e.target.value)}
            placeholder="جزئیات پروژه..."
          />
        </div>
      </div>
    </Modal>
  );
}
