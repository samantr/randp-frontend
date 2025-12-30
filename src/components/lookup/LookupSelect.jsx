import React, { useEffect, useMemo, useState } from "react";
import Button from "../common/Button";
import { normalizeFaText } from "../../utils/normalizeFa";

export default function LookupSelect({
  label,
  value,
  onChange,
  fetchOptions, // async ({q}) => array
  display, // (option) => string
  placeholder = "انتخاب کنید...",
  onQuickAdd, // open quick add modal
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);

  const nq = useMemo(() => normalizeFaText(q), [q]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchOptions({ q: nq });
        if (alive) setOptions(data || []);
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, nq, fetchOptions]);

  const selectedText = value ? display(value) : "";

  return (
    <div className="w-full">
      {label && <div className="mb-1 text-sm text-zinc-700">{label}</div>}

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-right hover:bg-zinc-50"
          onClick={() => setOpen(true)}
          type="button"
        >
          {selectedText || <span className="text-zinc-400">{placeholder}</span>}
        </button>

        {onQuickAdd && (
          <Button variant="secondary" onClick={onQuickAdd}>
            + افزودن سریع
          </Button>
        )}
      </div>

      {open && (
        <div className="relative mt-2 rounded-2xl border bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
              placeholder="جستجو..."
              autoFocus
            />
            <button className="mr-2 rounded-lg px-2 py-1 hover:bg-zinc-100" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="max-h-56 overflow-auto">
            {loading ? (
              <div className="text-sm text-zinc-500 py-2">در حال جستجو...</div>
            ) : options.length === 0 ? (
              <div className="text-sm text-zinc-500 py-2">نتیجه‌ای یافت نشد</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  className="w-full text-right rounded-lg px-3 py-2 hover:bg-zinc-50"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  type="button"
                >
                  {display(opt)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
