import api from "./axios";

export async function login(username, password) {
  // backend expects @RequestParam
  const res = await api.post(`/api/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
  return res.data; // token string
}
