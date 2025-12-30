import React from "react";
import Button from "../components/common/Button";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-10 border-b bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm text-zinc-700">سیستم رسید و پرداخت</div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/login";
            }}
          >
            خروج
          </Button>
        </div>
      </div>
    </header>
  );
}
