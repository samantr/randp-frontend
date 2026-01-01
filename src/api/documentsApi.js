import api from "./axios";

// ---------------- Debts ----------------
export async function listDebtDocuments(debtId) {
  const res = await api.get(`/api/v1/debts/${debtId}/documents`);
  return res.data;
}

export async function uploadDebtDocument(debtId, { file, dsc }) {
  const fd = new FormData();
  fd.append("file", file);
  if (dsc != null && String(dsc).trim() !== "") fd.append("dsc", String(dsc).trim());

  const res = await api.post(`/api/v1/debts/${debtId}/documents`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function deleteDebtDocument(debtId, docId) {
  const res = await api.delete(`/api/v1/debts/${debtId}/documents/${docId}`);
  return res.data;
}

export async function downloadDebtDocument(docId) {
  const res = await api.get(`/api/v1/debt-documents/${docId}/download`, { responseType: "blob" });
  return res;
}

// ---------------- Transactions ----------------
export async function listTransactionDocuments(transactionId) {
  const res = await api.get(`/api/v1/transactions/${transactionId}/documents`);
  return res.data;
}

export async function uploadTransactionDocument(transactionId, { file, dsc }) {
  const fd = new FormData();
  fd.append("file", file);
  if (dsc != null && String(dsc).trim() !== "") fd.append("dsc", String(dsc).trim());

  const res = await api.post(`/api/v1/transactions/${transactionId}/documents`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function deleteTransactionDocument(transactionId, docId) {
  const res = await api.delete(`/api/v1/transactions/${transactionId}/documents/${docId}`);
  return res.data;
}

export async function downloadTransactionDocument(docId) {
  const res = await api.get(`/api/v1/transaction-documents/${docId}/download`, { responseType: "blob" });
  return res;
}
