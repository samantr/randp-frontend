import React, { useEffect, useRef, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import { updatePerson } from "../../api/personsApi";

export default function EditPersonModal({ open, person, loading, onClose, onUpdated }) {
  const [isLegal, setIsLegal] = useState(false);

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tel, setTel] = useState("");
  const [address, setAddress] = useState("");
  const [dsc, setDsc] = useState("");

  // We only want to clear companyName when USER switches from حقوقی -> حقیقی
  const prevIsLegalRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // reset to avoid stale values
    setIsLegal(false);
    setName("");
    setLastName("");
    setCompanyName("");
    setTel("");
    setAddress("");
    setDsc("");

    // reset previous tracker for this open session
    prevIsLegalRef.current = null;

    if (!person) return;

    setIsLegal(!!person.isLegal);
    setName(person.name || "");
    setLastName(person.lastName || "");
    setCompanyName(person.companyName || "");
    setTel(person.tel || "");
    setAddress(person.address || "");
    setDsc(person.dsc || "");
  }, [open, person]);

  // Clear companyName ONLY when user changes type from حقوقی -> حقیقی
  useEffect(() => {
    if (!open) return;

    const prev = prevIsLegalRef.current;

    // first run after open: just record and do nothing
    if (prev === null) {
      prevIsLegalRef.current = isLegal;
      return;
    }

    // user switched from legal to natural
    if (prev === true && isLegal === false) {
      setCompanyName("");
    }

    prevIsLegalRef.current = isLegal;
  }, [isLegal, open]);

  async function handleSave() {
    if (!person?.id) {
      toast.error("اطلاعات شخص هنوز بارگذاری نشده است");
      return;
    }

    const payload = {
      name: name?.trim() || null,
      lastName: lastName?.trim() || null,
      companyName: isLegal ? (companyName?.trim() || null) : null,
      address: address?.trim() || null,
      tel: tel?.trim() || null,
      isLegal,
      dsc: dsc?.trim() || null,
    };

    if (payload.isLegal) {
      if (!payload.companyName) {
        toast.error("نام سازمان را وارد کنید");
        return;
      }
    } else {
      if (!payload.name && !payload.lastName) {
        toast.error("نام یا نام خانوادگی را وارد کنید");
        return;
      }
    }

    try {
      await updatePerson(person.id, payload);
      toast.success("ویرایش شد");
      onUpdated?.();
      onClose?.();
    } catch (e) {
      toast.error("خطا در ویرایش");
    }
  }

  return (
    <Modal
      open={open}
      title="ویرایش شخص"
      onClose={onClose}
      footer={
        <div className="flex gap-2 justify-start">
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={handleSave} disabled={loading || !person}>
            ذخیره
          </Button>
        </div>
      }
    >
      {loading && (
        <div className="mb-3 text-sm text-zinc-500">در حال بارگذاری اطلاعات...</div>
      )}

      <div className="mb-4 rounded-xl border bg-zinc-50 p-3">
        <div className="font-semibold mb-2 text-sm">نوع شخص</div>
        <div className="flex items-center gap-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="personTypeEdit"
              checked={!isLegal}
              onChange={() => setIsLegal(false)}
              disabled={loading || !person}
            />
            <span>حقیقی</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="personTypeEdit"
              checked={isLegal}
              onChange={() => setIsLegal(true)}
              disabled={loading || !person}
            />
            <span>حقوقی</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="نام"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading || !person}
        />
        <Input
          label="نام خانوادگی"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={loading || !person}
        />

        <Input
          label="نام سازمان"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="برای اشخاص حقوقی"
          disabled={loading || !person || !isLegal}
        />

        <Input
          label="تلفن"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          placeholder="مثلاً 0912..."
          disabled={loading || !person}
        />

        <div className="md:col-span-2">
          <Input
            label="آدرس"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading || !person}
          />
        </div>

        <div className="md:col-span-2">
          <Input
            label="توضیحات"
            value={dsc}
            onChange={(e) => setDsc(e.target.value)}
            disabled={loading || !person}
          />
        </div>
      </div>
    </Modal>
  );
}
