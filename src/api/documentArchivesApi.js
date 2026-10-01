import api from "./axios";

const BASE_URL = "/api/v1/document-archives";

function appendArchiveFiles(formData, files = [], documentDescriptions = []) {
  files.forEach((file, index) => {
    formData.append("files", file);
    formData.append("documentDescriptions", documentDescriptions[index] || "");
  });
}

export async function listDocumentArchives({
  page = 0,
  size = 20,
  code = "",
  description = "",
  from = "",
  to = "",
} = {}) {
  const params = { page, size };

  if (code?.trim()) params.code = code.trim();
  if (description?.trim()) params.description = description.trim();
  if (from?.trim()) params.from = from.trim();
  if (to?.trim()) params.to = to.trim();

  const res = await api.get(BASE_URL, { params });
  return res.data;
}

export async function getDocumentArchive(id) {
  const res = await api.get(`${BASE_URL}/${id}`);
  return res.data;
}

export async function createDocumentArchive({
  description,
  archiveDate,
  files = [],
  documentDescriptions = [],
  onUploadProgress,
}) {
  const formData = new FormData();
  formData.append("description", description || "");
  formData.append("archiveDate", archiveDate || "");
  appendArchiveFiles(formData, files, documentDescriptions);

  const res = await api.post(BASE_URL, formData, { onUploadProgress });
  return res.data;
}

export async function updateDocumentArchive(id, payload) {
  const res = await api.put(`${BASE_URL}/${id}`, payload);
  return res.data;
}

export async function uploadDocumentArchiveDocuments(
  id,
  { files = [], documentDescriptions = [], onUploadProgress } = {},
) {
  const formData = new FormData();
  appendArchiveFiles(formData, files, documentDescriptions);

  const res = await api.post(`${BASE_URL}/${id}/documents`, formData, {
    onUploadProgress,
  });
  return res.data;
}

export async function deleteDocumentArchiveDocument(archiveId, documentId) {
  await api.delete(`${BASE_URL}/${archiveId}/documents/${documentId}`);
}

export async function downloadDocumentArchiveDocument(archiveId, documentId) {
  return api.get(`${BASE_URL}/${archiveId}/documents/${documentId}/download`, {
    responseType: "blob",
  });
}

export async function deleteDocumentArchive(id) {
  await api.delete(`${BASE_URL}/${id}`);
}
