import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import LookupSelect from "../lookup/LookupSelect";
import { updateItem } from "../../api/itemsApi";
import { getItemCategoryLookups } from "../../api/itemCategoriesApi";
import { normalizeFaText } from "../../utils/normalizeFa";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";
import {
  lookupDisplayName,
  lookupMatches,
  sortLookupOptions,
} from "../../utils/lookupOptions";

export default function EditItemModal({
  open,
  item,
  loading,
  onClose,
  onUpdated,
  onOpenQuickAddCategory,
  lastCreatedCategory,
  consumeLastCreatedCategory,
}) {
  const [category, setCategory] = useState(null);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [dsc, setDsc] = useState("");

  useEffect(() => {
    if (!open) return;

    setCode(item?.code || "");
    setTitle(item?.title || "");
    setDsc(item?.dsc || "");

    if (item?.categoryId) {
      setCategory({ id: item.categoryId, title: item.categoryTitle || `#${item.categoryId}` });
    } else {
      setCategory(null);
    }
  }, [open, item]);

  // if user quick-added a category while modal is open, auto-select it
  useEffect(() => {
    if (!open) return;
    if (lastCreatedCategory?.id) {
      setCategory(lastCreatedCategory);
      consumeLastCreatedCategory?.();
    }
  }, [open, lastCreatedCategory, consumeLastCreatedCategory]);

  async function fetchCategories({ q }) {
    const all = await getItemCategoryLookups();
    const nq = normalizeFaText(q || "");
    const filtered = !nq
      ? all
      : (all || []).filter((c) => lookupMatches(c, nq));
    return filtered.sort(sortLookupOptions);
  }

  const canSubmit = useMemo(() => !loading && !!item?.id, [loading, item]);

  async function handleUpdate() {
    if (!item?.id) return;

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
      const updated = await updateItem(item.id, payload);
      toast.success("ویرایش شد");
      onUpdated?.(updated);
      onClose?.();
    } catch(e) {
      toast.error(getApiErrorMessage(e, "خطا در ویرایش"));
    }
  }

  return (
    <Modal
      open={open}
      title="ویرایش کالا/خدمت"
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
      ) : !item ? (
        <div className="text-sm text-zinc-500">موردی انتخاب نشده است</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <LookupSelect
              label="دسته‌بندی"
              value={category}
              onChange={setCategory}
              fetchOptions={fetchCategories}
              display={(c) => lookupDisplayName(c)}
              placeholder="انتخاب دسته‌بندی..."
              onQuickAdd={onOpenQuickAddCategory}
            />
          </div>

          <Input label="کد" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input label="عنوان" value={title} onChange={(e) => setTitle(e.target.value)} />

          <div className="md:col-span-2">
            <Input label="توضیحات" value={dsc} onChange={(e) => setDsc(e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
