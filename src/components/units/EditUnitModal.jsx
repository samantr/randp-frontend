import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import { updateUnit } from "../../api/unitsApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

export default function EditUnitModal({ open, unit, loading, onClose, onUpdated }) {
  const [title, setTitle] = useState("");
  const [dsc, setDsc] = useState("");

  useEffect(() => {
    if (!open) return;

    setTitle("");
    setDsc("");

    if (!unit) return;

    setTitle(unit.title || "");
    setDsc(unit.dsc || "");
  }, [open, unit]);

  async function handleSave() {
    if (!unit?.id) {
      toast.error(getApiErrorMessage(e, "اطلاعات واحد هنوز بارگذاری نشده است"));
      return;
    }

    const payload = {
      title: title?.trim(),
      dsc: dsc?.trim() || null,
    };

    if (!payload.title) {
      toast.error(getApiErrorMessage(e, "عنوان واحد را وارد کنید"));
      return;
    }

    try {
      await updateUnit(unit.id, payload);
      toast.success("ویرایش شد");
      onUpdated?.();
      onClose?.();
    } catch(e) {
      toast.error(getApiErrorMessage(e, "خطا در ویرایش"));
    }
  }

  return (
    <Modal
      open={open}
      title="ویرایش واحد"
      onClose={onClose}
      footer={
        <div className="flex gap-2 justify-start">
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleSave} disabled={loading || !unit}>
            ذخیره
          </Button>
        </div>
      }
    >
      {loading && (
        <div className="mb-3 text-sm text-zinc-500">در حال بارگذاری اطلاعات...</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="عنوان"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading || !unit}
        />

        <div className="md:col-span-2">
          <Input
            label="توضیحات (اختیاری)"
            value={dsc}
            onChange={(e) => setDsc(e.target.value)}
            disabled={loading || !unit}
          />
        </div>
      </div>
    </Modal>
  );
}
