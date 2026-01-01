import React from "react";
import { NavLink } from "react-router-dom";

const nav = [
  { to: "/", label: "داشبورد" },
  { to: "/persons", label: "اشخاص" },
  { to: "/item-categories", label: "دسته‌بندی‌ها" },
  { to: "/items", label: "کالا/خدمات" },
  { to: "/units", label: "واحدها" },
  { to: "/projects", label: "پروژه‌ها" },
  { to: "/debts", label: "بدهی‌ها" },
  { to: "/transactions", label: "تراکنش‌ها" },
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={`
         h-screen bg-white
        ${collapsed ? "w-16" : "w-64"}
        transition-all
        border-l
      `}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className={`font-bold ${collapsed ? "hidden" : "block"}`}>
          RandP
        </div>
        <button
          className="rounded-lg px-2 py-1 hover:bg-zinc-100"
          onClick={onToggle}
        >
          ☰
        </button>
      </div>

      <nav className="p-2">
        {nav.map((x) => (
          <NavLink
            key={x.to}
            to={x.to}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm mb-1 hover:bg-zinc-100 ${
                isActive ? "bg-zinc-100 font-semibold" : ""
              }`
            }
          >
            {collapsed ? x.label?.[0] : x.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
