import api from "./axios";

export async function refreshDashboardMart() {
  const res = await api.post("/api/v1/dashboard/refresh");
  return res.data;
}

export async function getLastRefresh() {
  const res = await api.get("/api/v1/dashboard/last-refresh");
  return res.data;
}

export async function getDashboardSummary({ from, to }) {
  const res = await api.get("/api/v1/dashboard/summary", { params: { from, to } });
  return res.data;
}

export async function getDashboardCashflow({ from, to }) {
  const res = await api.get("/api/v1/dashboard/cashflow", { params: { from, to } });
  return res.data;
}

export async function getTopPayers({ from, to, limit = 10 }) {
  const res = await api.get("/api/v1/dashboard/top-payers", { params: { from, to, limit } });
  return res.data;
}

export async function getTopReceivers({ from, to, limit = 10 }) {
  const res = await api.get("/api/v1/dashboard/top-receivers", { params: { from, to, limit } });
  return res.data;
}

/* ====== NEW: layer A / layer B ====== */
export async function getPersonsSummary({ from, to, limit = 50 }) {
  const res = await api.get("/api/v1/dashboard/persons-summary", { params: { from, to, limit } });
  return res.data;
}

export async function getPersonPayables({ personId, from, to, limit = 50 }) {
  const res = await api.get(`/api/v1/dashboard/persons/${personId}/payables`, {
    params: { from, to, limit },
  });
  return res.data;
}
