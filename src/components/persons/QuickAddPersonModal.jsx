// src/components/persons/QuickAddPersonModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import toast from "react-hot-toast";
import { normalizeFaText } from "../../utils/normalizeFa";
import { createPerson, searchPersons } from "../../api/personsApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";


/**
 * Backend contract (PersonResponse):
 * {
 *  id: number,
 *  name: string,
 *  lastName: string,
 *  companyName: string,
 *  address: string,
 *  tel: string,
 *  isLegal: boolean,
 *  dsc: string
 * }
 */

function personLabel(p) {
  if (p?.isLegal) return p.companyName || `#${p.id}`;
  const full = `${p?.name || ""} ${p?.lastName || ""}`.trim();
  return full || p.companyName || `#${p.id}`;
}

export default function QuickAddPersonModal({
  open,
  onClose,
  onCreated,
  initialQuery = "",
}) {
  // UI fields
  const [isLegal, setIsLegal] = useState(false); // false=حقیقی, true=حقوقی
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tel, setTel] = useState("");
  const [address, setAddress] = useState("");
  const [dsc, setDsc] = useState("");

  // Similar results
  const [similar, setSimilar] = useState([]);
  const [simLoading, setSimLoading] = useState(false);

  // For similarity search, choose the strongest typed field
  const liveQuery = useMemo(() => {
    const base =
      tel?.trim() ||
      companyName?.trim() ||
      `${name || ""} ${lastName || ""}`.trim() ||
      initialQuery;
    return normalizeFaText(base || "");
  }, [tel, companyName, name, lastName, initialQuery]);

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    setIsLegal(false);
    setName("");
    setLastName("");
    setCompanyName("");
    setTel("");
    setAddress("");
    setDsc("");
    setSimilar([]);
  }, [open]);

  // When switching to حقیقی: disable/clear organization
  useEffect(() => {
    if (!open) return;
    if (!isLegal) {
      setCompanyName("");
    }
  }, [isLegal, open]);

  // Load similar persons while typing
  useEffect(() => {
    if (!open) return;
    if (!liveQuery || liveQuery.length < 2) {
      setSimilar([]);
      return;
    }

    let alive = true;
    const t = setTimeout(async () => {
      setSimLoading(true);
      try {
        const page = await searchPersons({ q: liveQuery, page: 0, size: 5 });
        if (alive) setSimilar(page?.content || []);
      } catch (e) {
        if (alive) setSimilar([]);
      } finally {
        if (alive) setSimLoading(false);
      }
    }, 400);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, liveQuery]);

  // Strong duplicate signal by tel
  const exactTelMatch = useMemo(() => {
    const t = normalizeFaText(tel);
    if (!t) return null;
    return similar.find((p) => normalizeFaText(p.tel) === t) || null;
  }, [tel, similar]);

  async function handleCreate() {
    const payload = {
      name: name?.trim() || null,
      lastName: lastName?.trim() || null,
      companyName: isLegal ? (companyName?.trim() || null) : null,
      address: address?.trim() || null,
      tel: tel?.trim() || null,
      isLegal,
      dsc: dsc?.trim() || null,
    };

    // Validation (minimal)
    if (payload.isLegal) {
      if (!payload.companyName) {
        toast.error(getApiErrorMessage(e, "نام سازمان را وارد کنید"));
        return;
      }
    } else {
      if (!payload.name && !payload.lastName) {
        toast.error(getApiErrorMessage(e, "نام یا نام خانوادگی را وارد کنید"));
        return;
      }
    }

    // Warn on duplicate tel
    if (exactTelMatch) {
      const ok = window.confirm(
        "یک شخص با همین شماره تلفن قبلاً ثبت شده است. با این حال ثبت شود؟"
      );
      if (!ok) return;
    }

    try {
      const created = await createPerson(payload);
      toast.success("شخص ثبت شد");

      // ✅ بسیار مهم: created person را پاس می‌دهیم
      onCreated?.(created);

      onClose?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "خطا در ثبت شخص"));
    }
  }

  return (
    <Modal
      open={open}
      title="افزودن سریع شخص"
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
      {/* Type radio */}
      <div className="mb-4 rounded-xl border bg-zinc-50 p-3">
        <div className="font-semibold mb-2 text-sm">نوع شخص</div>
        <div className="flex items-center gap-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="personTypeAdd"
              checked={!isLegal}
              onChange={() => setIsLegal(false)}
            />
            <span>حقیقی</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="personTypeAdd"
              checked={isLegal}
              onChange={() => setIsLegal(true)}
            />
            <span>حقوقی</span>
          </label>
        </div>

        <div className="mt-2 text-xs text-zinc-600">
          {isLegal ? "حقوقی (سازمان/شرکت)" : "حقیقی (فرد)"}
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input label="نام" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="نام خانوادگی"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />

        <Input
          label="نام سازمان"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="برای اشخاص حقوقی"
          disabled={!isLegal}
        />

        <Input
          label="تلفن"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          placeholder="مثلاً 0912..."
        />

        <div className="md:col-span-2">
          <Input
            label="آدرس"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <Input
            label="توضیحات"
            value={dsc}
            onChange={(e) => setDsc(e.target.value)}
          />
        </div>
      </div>

      {/* Similar persons */}
      <div className="mt-4 rounded-xl border bg-zinc-50 p-3">
        <div className="mb-2 font-semibold text-sm">افراد مشابه</div>

        {exactTelMatch && (
          <div className="mb-2 rounded-lg bg-yellow-100 px-3 py-2 text-sm text-yellow-900">
            این شخص با همین تلفن قبلاً ثبت شده است.
          </div>
        )}

        {simLoading ? (
          <div className="text-sm text-zinc-500">در حال جستجو...</div>
        ) : similar.length === 0 ? (
          <div className="text-sm text-zinc-500">مورد مشابهی یافت نشد</div>
        ) : (
          <div className="space-y-2">
            {similar.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-white border px-3 py-2"
              >
                <div className="text-sm">{personLabel(p)}</div>
                <div className="text-xs text-zinc-500">{p.tel || "-"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
