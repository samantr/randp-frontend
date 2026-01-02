import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import LookupSelect from "../lookup/LookupSelect";
import { normalizeFaText } from "../../utils/normalizeFa";
import { createItem } from "../../api/itemsApi";
import { getItemCategories } from "../../api/itemCategoriesApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

export default function QuickAddItemModal({
  open,
  onClose,
  onCreated,
  onOpenQuickAddCategory,
  lastCreatedCategory,
  consumeLastCreatedCategory,
}) {
  const [category, setCategory] = useState(null);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [dsc, setDsc] = useState("");

  // reset
  useEffect(() => {
    if (!open) return;
    setCategory(null);
    setCode("");
    setTitle("");
    setDsc("");
  }, [open]);

  // if user quick-added a category while modal is open, auto-select it
  useEffect(() => {
    if (!open) return;
    if (lastCreatedCategory?.id) {
      setCategory(lastCreatedCategory);
      consumeLastCreatedCategory?.();
    }
  }, [open, lastCreatedCategory, consumeLastCreatedCategory]);

  const liveQuery = useMemo(() => normalizeFaText(`${code} ${title}`.trim()), [code, title]);

  async function fetchCategories({ q }) {
    const all = await getItemCategories();
    const nq = normalizeFaText(q || "");
    const filtered = !nq
      ? all
      : (all || []).filter((c) => normalizeFaText(c.title).includes(nq));
    return filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }

  async function handleCreate() {
    const payload = {
      categoryId: category?.id || null,
      code: code?.trim(),
      title: title?.trim(),
      dsc: dsc?.trim() || null,
    };

    if (!payload.categoryId) {
      toast.error(getApiErrorMessage(e, "دسته‌بندی را انتخاب کنید"));
      return;
    }
    if (!payload.code) {
      toast.error(getApiErrorMessage(e, "کد را وارد کنید"));
      return;
    }
    if (!payload.title) {
      toast.error(getApiErrorMessage(e, "عنوان را وارد کنید"));
      return;
    }

    try {
      const created = await createItem(payload);
      toast.success("کالا/خدمت ثبت شد");
      onCreated?.(created);
      onClose?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در ثبت"));
    }
  }

  return (
    <Modal
      open={open}
      title="افزودن سریع کالا/خدمت"
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
        <div className="md:col-span-2">
          <LookupSelect
            label="دسته‌بندی"
            value={category}
            onChange={setCategory}
            fetchOptions={fetchCategories}
            display={(c) => c?.title || `#${c?.id}`}
            placeholder="انتخاب دسته‌بندی..."
            onQuickAdd={onOpenQuickAddCategory}
          />
        </div>

        <Input
          label="کد"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="مثلاً CEM001"
        />

        <Input
          label="عنوان"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثلاً سیمان"
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
