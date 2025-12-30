import React from "react";

export default function DataTable({ columns, rows, loading, emptyText = "موردی یافت نشد" }) {
  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 sticky top-0">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-right px-4 py-3 font-semibold text-zinc-700 whitespace-nowrap">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={columns.length}>
                  در حال بارگذاری...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r._key || idx} className="border-t hover:bg-zinc-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 whitespace-nowrap">
                      {c.render ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
