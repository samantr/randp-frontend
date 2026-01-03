import React, { useState } from "react";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import toast from "react-hot-toast";
import { login } from "../../api/authApi";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage"; // اضافه کن

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await login(username, password);
      localStorage.setItem("token", token);
      toast.success("ورود موفق");
      window.location.href = "/";
    } catch(e) {
      toast.error(getApiErrorMessage(e, "نام کاربری یا رمز عبور اشتباه است"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-xl font-bold mb-1">ورود</div>
        <div className="text-sm text-zinc-600 mb-4">برای ادامه وارد شوید</div>

        <div className="space-y-3">
          <Input label="نام کاربری" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input label="رمز عبور" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="mt-4">
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "در حال ورود..." : "ورود"}
          </Button>
        </div>
      </form>
    </div>
  );
}
