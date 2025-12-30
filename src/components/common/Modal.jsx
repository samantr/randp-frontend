import React from "react";

export default function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b p-4">
            <div className="text-base font-semibold">{title}</div>
            <button className="rounded-lg px-2 py-1 hover:bg-zinc-100" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="p-4">{children}</div>

          {footer && <div className="border-t p-4">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
