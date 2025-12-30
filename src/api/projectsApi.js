import api from "./axios";

export async function getProjects() {
  const res = await api.get("/api/v1/projects");
  return res.data; // List<ProjectResponse>
}

export async function getProjectById(id) {
  const res = await api.get(`/api/v1/projects/${id}`);
  return res.data; // ProjectResponse
}

export async function createProject(payload) {
  const res = await api.post("/api/v1/projects", payload);
  return res.data; // ProjectResponse
}

export async function updateProject(id, payload) {
  const res = await api.put(`/api/v1/projects/${id}`, payload);
  return res.data; // ProjectResponse
}

export async function deleteProject(id) {
  await api.delete(`/api/v1/projects/${id}`);
}
