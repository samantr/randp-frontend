import api from "./axios";

export async function getUnits() {
  const res = await api.get("/api/v1/units");
  return res.data; // List<UnitResponse>
}

export async function getUnitById(id) {
  const res = await api.get(`/api/v1/units/${id}`);
  return res.data; // UnitResponse
}

export async function createUnit(payload) {
  const res = await api.post("/api/v1/units", payload);
  return res.data; // UnitResponse
}

export async function updateUnit(id, payload) {
  const res = await api.put(`/api/v1/units/${id}`, payload);
  return res.data; // UnitResponse
}

export async function deleteUnit(id) {
  await api.delete(`/api/v1/units/${id}`);
}
