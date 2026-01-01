import api from "./axios";

export async function listAllocationsByTransaction(txId) {
  const res = await api.get(`/api/v1/transactions/${txId}/allocations`);
  return res.data;
}

// payload: { debtId, coveredAmount, dsc }
export async function createAllocationFromTransaction(txId, payload) {
  const res = await api.post(`/api/v1/transactions/${txId}/allocations`, payload);
  return res.data;
}

// payload: { debtId, coveredAmount, dsc }
export async function updateAllocationFromTransaction(txId, allocationId, payload) {
  const res = await api.put(`/api/v1/transactions/${txId}/allocations/${allocationId}`, payload);
  return res.data;
}

export async function deleteAllocationFromTransaction(txId, allocationId) {
  const res = await api.delete(`/api/v1/transactions/${txId}/allocations/${allocationId}`);
  return res.data;
}

// ALL debts in same project for this transaction (for create/edit)
// GET /api/v1/transactions/{txId}/allocation-candidates/debts?allocationId=123
export async function listDebtCandidatesForTransaction(txId, { allocationId = null } = {}) {
  const res = await api.get(`/api/v1/transactions/${txId}/allocation-candidates/debts`, {
    params: allocationId ? { allocationId } : {},
  });
  return res.data;
}
