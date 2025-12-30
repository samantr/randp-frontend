import api from "./axios";

export async function getItems() {
  const res = await api.get("/api/v1/items");
  return res.data; // List<ItemResponse>
}

export async function getItemById(id) {
  const res = await api.get(`/api/v1/items/${id}`);
  return res.data; // ItemResponse
}

export async function searchItems({ q = "", categoryId = null }) {
  const params = {};
  if (q && q.trim()) params.q = q.trim();
  if (categoryId) params.categoryId = categoryId;
  const res = await api.get("/api/v1/items/search", { params });
  return res.data; // List<ItemResponse>
}

export async function createItem(payload) {
  const res = await api.post("/api/v1/items", payload);
  return res.data; // ItemResponse
}

export async function updateItem(id, payload) {
  const res = await api.put(`/api/v1/items/${id}`, payload);
  return res.data; // ItemResponse
}

export async function deleteItem(id) {
  await api.delete(`/api/v1/items/${id}`);
}
