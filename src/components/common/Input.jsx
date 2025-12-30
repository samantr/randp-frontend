import React from "react";

export default function Input({ label, error, className = "", ...props }) {
  return (
    <div className="w-full">
      {label && <div className="mb-1 text-sm text-zinc-700">{label}</div>}
      <input
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 ${
          error ? "border-red-400" : "border-zinc-200"
        } ${className}`}
        {...props}
      />
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}
