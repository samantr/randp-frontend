import api from "./axios";

/**
 * We call the same endpoint with optional params.
 * If backend returns Spring Page => {content, totalPages, ...}
 * If backend returns List => we normalize in UI layer.
 */
export async function getTransactions({ page = 0, size = 20, q = "" } = {}) {
  const params = { page, size };
  if (q && q.trim()) params.q = q.trim();

  const res = await api.get("/api/v1/transactions", { params });
  return res.data;
}

export async function getTransactionById(id) {
  const res = await api.get(`/api/v1/transactions/${id}`);
  return res.data;
}

export async function createTransaction(payload) {
  const res = await api.post("/api/v1/transactions", payload);
  return res.data;
}

export async function updateTransaction(id, payload) {
  const res = await api.put(`/api/v1/transactions/${id}`, payload);
  return res.data;
}

export async function deleteTransaction(id) {
  await api.delete(`/api/v1/transactions/${id}`);
}
