import api from "./axios";

export async function createDebt(payload) {
  const res = await api.post("/api/v1/debts", payload);
  return res.data; // DebtHeaderResponse
}

export async function getDebtById(id) {
  const res = await api.get(`/api/v1/debts/${id}`);
  return res.data; // DebtHeaderResponse
}

export async function updateDebt(id, payload) {
  const res = await api.put(`/api/v1/debts/${id}`, payload);
  return res.data; // DebtHeaderResponse
}

export async function deleteDebt(id) {
  await api.delete(`/api/v1/debts/${id}`);
}

export async function getDebtView(id) {
  const res = await api.get(`/api/v1/debts/${id}/view`);
  return res.data; // DebtViewResponse
}

export async function getOpenDebts({ projectId, personId }) {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  if (personId) params.set("personId", personId);

  const res = await api.get(`/api/v1/debts/open?${params.toString()}`);
  return res.data; // List<Map<String,Object>>
}


// GET /api/v1/debts?itemId=123
export async function getAllDebts({ itemId } = {}) {
  const params = {};
  if (itemId != null && itemId !== "") params.itemId = itemId;

  const res = await api.get("/api/v1/debts", { params });
  return res.data;
}

