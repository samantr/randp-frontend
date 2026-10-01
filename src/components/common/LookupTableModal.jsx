import React, { useMemo, useState } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";

export default function LookupTableModal({
  open,
  title = "انتخاب",
  rows = [],
  columns = [],
  getRowKey = (r) => r.id,
  onSelect,
  onClose,
  searchPlaceholder = "جستجو...",
  searchKeys = [], // e.g. ["code", "personTitle"]
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    if (!query) return rows;

    return (rows || []).filter((r) => {
      // if searchKeys provided, use them; else fallback stringify
      if (Array.isArray(searchKeys) && searchKeys.length > 0) {
        return searchKeys.some((k) => {
          const v = r?.[k];
          if (v === null || v === undefined) return false;
          return String(v).toLowerCase().includes(query);
        });
      }
      return JSON.stringify(r).toLowerCase().includes(query);
    });
  }, [rows, q, searchKeys]);

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        setQ("");
        onClose?.();
      }}
      footer={
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setQ("");
              onClose?.();
            }}
          >
            بستن
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input
          label="جستجو"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
        />

        <div className="text-xs text-zinc-500">تعداد: {filtered.length}</div>

        <div className="max-h-[55dvh] overflow-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50 text-zinc-600">
              <tr className="border-b">
                {columns.map((c) => (
                  <th key={c.key} className="py-2 px-3 text-right whitespace-nowrap">
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={getRowKey(r)}
                  className="border-b last:border-b-0 hover:bg-zinc-50 cursor-pointer"
                  onClick={() => {
                    onSelect?.(r);
                    setQ("");
                    onClose?.();
                  }}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="py-2 px-3 whitespace-nowrap">
                      {c.render ? c.render(r) : (r?.[c.key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td className="py-4 px-3 text-center text-zinc-500" colSpan={columns.length}>
                    موردی یافت نشد
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-zinc-500">
          نکته: برای انتخاب، روی ردیف کلیک کنید.
        </div>
      </div>
    </Modal>
  );
}
