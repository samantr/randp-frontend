import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import LookupSelect from "../lookup/LookupSelect";
import { normalizeFaText } from "../../utils/normalizeFa";
import { getItemCategories, updateItemCategory } from "../../api/itemCategoriesApi";

export default function EditItemCategoryModal({
  open,
  category,
  loading,
  onClose,
  onUpdated,
}) {
  const [title, setTitle] = useState("");
  const [dsc, setDsc] = useState("");
  const [parent, setParent] = useState(null);

  useEffect(() => {
    if (!open) return;

    setTitle(category?.title || "");
    setDsc(category?.dsc || "");

    // parent resolved later via options list (keep only id for now)
    setParent(
      category?.parentId
        ? { id: category.parentId, title: `#${category.parentId}` }
        : null
    );
  }, [open, category]);

  async function fetchParents({ q }) {
    const all = await getItemCategories();

    // cannot choose itself as parent
    const selfId = category?.id;
    const candidates = (all || []).filter((c) => c.id !== selfId);

    const nq = normalizeFaText(q || "");
    const filtered = !nq
      ? candidates
      : candidates.filter((c) => normalizeFaText(c.title).includes(nq));

    return filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }

  const canSubmit = useMemo(() => {
    return !loading && !!category?.id;
  }, [loading, category]);

  async function handleUpdate() {
    if (!category?.id) return;

    const payload = {
      title: title?.trim(),
      parentId: parent?.id || null,
      dsc: dsc?.trim() || null,
    };

    if (!payload.title) {
      toast.error("عنوان را وارد کنید");
      return;
    }

    // prevent self parent
    if (payload.parentId && payload.parentId === category.id) {
      toast.error("والد نمی‌تواند خودِ دسته‌بندی باشد");
      return;
    }

    try {
      const updated = await updateItemCategory(category.id, payload);
      toast.success("ویرایش شد");
      onUpdated?.(updated);
      onClose?.();
    } catch (e) {
      toast.error("خطا در ویرایش");
    }
  }

  return (
    <Modal
      open={open}
      title="ویرایش دسته‌بندی"
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
      ) : !category ? (
        <div className="text-sm text-zinc-500">موردی انتخاب نشده است</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="عنوان"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <LookupSelect
            label="والد (اختیاری)"
            value={parent?.id ? parent : null}
            onChange={setParent}
            fetchOptions={fetchParents}
            display={(c) => c?.title || `#${c?.id}`}
            placeholder="بدون والد (ریشه)"
          />

          <div className="md:col-span-2">
            <Input
              label="توضیحات"
              value={dsc}
              onChange={(e) => setDsc(e.target.value)}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
