import api from "./axios";

export async function login(username, password) {
  // backend expects @RequestParam
  const res = await api.post(
    `/api/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  );

  // new backend returns { token: "..." }
  if (res?.data?.token) return res.data.token;

  // fallback (older behavior): token as plain string
  if (typeof res?.data === "string") return res.data;

  throw new Error("TOKEN_NOT_RECEIVED");
}
