import React from "react";
import Button from "../common/Button";

export default function Pagination({ page, totalPages, onPage }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-zinc-600">
        صفحه {page + 1} از {Math.max(totalPages, 1)}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 0} onClick={() => onPage(page - 1)}>
          قبلی
        </Button>
        <Button variant="secondary" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>
          بعدی
        </Button>
      </div>
    </div>
  );
}
