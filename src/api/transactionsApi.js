import api from "./axios";

export async function getTransactions({
  page = 0,
  size = 20,
  q = "",
  transactionId = null,
  projectId = null,
  categoryId = null,
  fromPid = null,
  toPid = null,
  transactionType = "",
  from = "",
  to = "",
} = {}) {
  const params = { page, size };

  if (q?.trim()) params.q = q.trim();

  if (transactionId != null) {
    params.transactionId = transactionId;
  }

  if (projectId != null) {
    params.projectId = projectId;
  }

  if (categoryId != null) {
    params.categoryId = categoryId;
  }

  if (fromPid != null) {
    params.fromPid = fromPid;
  }

  if (toPid != null) {
    params.toPid = toPid;
  }

  if (transactionType?.trim()) {
    params.transactionType = transactionType.trim();
  }

  if (from?.trim()) {
    params.from = from.trim();
  }

  if (to?.trim()) {
    params.to = to.trim();
  }

  const res = await api.get("/api/v1/transactions", {
    params,
  });

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
  const res = await api.put(
    `/api/v1/transactions/${id}`,
    payload,
  );

  return res.data;
}

export async function deleteTransaction(id) {
  await api.delete(`/api/v1/transactions/${id}`);
}