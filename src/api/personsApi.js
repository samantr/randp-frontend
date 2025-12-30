import api from "./axios";

export async function getPersons({ page = 0, size = 20 }) {
  const res = await api.get("/api/v1/persons", { params: { page, size } });
  return res.data; // Page<PersonResponse>
}

export async function getPersonById(id) {
  const res = await api.get(`/api/v1/persons/${id}`);
  return res.data; // PersonResponse
}

export async function searchPersons({ q = "", page = 0, size = 20 }) {
  const res = await api.get("/api/v1/persons/search", { params: { q, page, size } });
  return res.data;
}

export async function createPerson(payload) {
  const res = await api.post("/api/v1/persons", payload);
  return res.data;
}

export async function updatePerson(id, payload) {
  const res = await api.put(`/api/v1/persons/${id}`, payload);
  return res.data;
}

export async function deletePerson(id) {
  await api.delete(`/api/v1/persons/${id}`);
}
