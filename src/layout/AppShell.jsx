import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = collapsed ? "4rem" : "16rem";

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-50">
      {/* Sidebar fixed on RIGHT */}
      <div
        className="fixed top-0 right-0 h-screen z-10"
        style={{ width: sidebarWidth }}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((p) => !p)}
        />
      </div>

      {/* Main content with RIGHT padding */}
      <div
        className="min-h-screen"
        style={{ paddingRight: sidebarWidth }}
      >
        <Topbar />
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}
