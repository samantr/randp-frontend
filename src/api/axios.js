import axios from "axios";

const api = axios.create({
  //baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  //baseURL: import.meta.env.VITE_API_BASE_URL || "http://192.168.1.2:8080",
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://172.16.41.211:8080",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
