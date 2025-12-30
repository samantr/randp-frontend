import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import LookupSelect from "../lookup/LookupSelect";
import { normalizeFaText } from "../../utils/normalizeFa";
import { createItemCategory, getItemCategories } from "../../api/itemCategoriesApi";

export default function QuickAddItemCategoryModal({
  open,
  onClose,
  onCreated,
  initialQuery = "",
}) {
  const [title, setTitle] = useState("");
  const [dsc, setDsc] = useState("");
  const [parent, setParent] = useState(null);

  // reset when opening
  useEffect(() => {
    if (!open) return;
    setTitle(initialQuery || "");
    setDsc("");
    setParent(null);
  }, [open, initialQuery]);

  const liveQuery = useMemo(() => normalizeFaText(title || ""), [title]);

  async function fetchParents({ q }) {
    const all = await getItemCategories();
    const nq = normalizeFaText(q || "");
    const filtered = !nq
      ? all
      : (all || []).filter((c) => normalizeFaText(c.title).includes(nq));

    // sort: root first, then by title
    return filtered.sort((a, b) => {
      const ap = a.parentId ? 1 : 0;
      const bp = b.parentId ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return (a.title || "").localeCompare(b.title || "");
    });
  }

  async function handleCreate() {
    const payload = {
      title: title?.trim(),
      parentId: parent?.id || null,
      dsc: dsc?.trim() || null,
    };

    if (!payload.title) {
      toast.error("عنوان را وارد کنید");
      return;
    }

    try {
      const created = await createItemCategory(payload);
      toast.success("دسته‌بندی ثبت شد");
      onCreated?.(created);
      onClose?.();
    } catch (e) {
      toast.error("خطا در ثبت دسته‌بندی");
    }
  }

  return (
    <Modal
      open={open}
      title="افزودن سریع دسته‌بندی"
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
          placeholder="مثلاً مصالح"
        />

        <LookupSelect
          label="والد (اختیاری)"
          value={parent}
          onChange={setParent}
          fetchOptions={fetchParents}
          display={(c) => (c?.title ? c.title : `#${c?.id}`)}
          placeholder="بدون والد (ریشه)"
        />

        <div className="md:col-span-2">
          <Input
            label="توضیحات"
            value={dsc}
            onChange={(e) => setDsc(e.target.value)}
            placeholder="اختیاری"
          />
        </div>

        {liveQuery && liveQuery.length >= 2 && (
          <div className="md:col-span-2 text-xs text-zinc-500">
            جستجو/نرمال‌سازی: <span className="font-mono">{liveQuery}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
