import React from "react";
import Input from "../common/Input";
import Button from "../common/Button";

export default function FiltersBar({
  q,
  setQ,
  onClear,
  rightSlot, // e.g. extra dropdown filters
}) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو..." />
        </div>

        {rightSlot}

        <Button variant="secondary" onClick={onClear}>
          پاک کردن
        </Button>
      </div>
    </div>
  );
}
