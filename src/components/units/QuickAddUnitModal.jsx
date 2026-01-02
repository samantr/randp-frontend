import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import { createUnit } from "../../api/unitsApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

export default function QuickAddUnitModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [dsc, setDsc] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDsc("");
  }, [open]);

  async function handleCreate() {
    const payload = {
      title: title?.trim(),
      dsc: dsc?.trim() || null,
    };

    if (!payload.title) {
      toast.error(getApiErrorMessage(e, "عنوان واحد را وارد کنید"));
      return;
    }

    try {
      const created = await createUnit(payload);
      toast.success("واحد ثبت شد");
      onCreated?.(created);
      onClose?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در ثبت واحد"));
    }
  }

  return (
    <Modal
      open={open}
      title="افزودن واحد"
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
          placeholder="مثلاً عدد، کیلوگرم، متر، سرویس..."
        />

        <div className="md:col-span-2">
          <Input
            label="توضیحات (اختیاری)"
            value={dsc}
            onChange={(e) => setDsc(e.target.value)}
            placeholder="جزئیات..."
          />
        </div>
      </div>
    </Modal>
  );
}
