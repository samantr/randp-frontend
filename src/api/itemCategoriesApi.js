import api from "./axios";

export async function getItemCategories() {
  const res = await api.get("/api/v1/item-categories");
  return res.data; // List<ItemCategoryResponse>
}

export async function getItemCategoryById(id) {
  const res = await api.get(`/api/v1/item-categories/${id}`);
  return res.data; // ItemCategoryResponse
}

export async function createItemCategory(payload) {
  const res = await api.post("/api/v1/item-categories", payload);
  return res.data; // ItemCategoryResponse
}

export async function updateItemCategory(id, payload) {
  const res = await api.put(`/api/v1/item-categories/${id}`, payload);
  return res.data; // ItemCategoryResponse
}

export async function deleteItemCategory(id) {
  await api.delete(`/api/v1/item-categories/${id}`);
}
