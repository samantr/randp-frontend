import api from "./axios";

export async function listAllocations(debtId) {
  const res = await api.get(`/api/v1/debts/${debtId}/allocations`);
  return res.data;
}

export async function createAllocation(debtId, payload) {
  // payload: { transactionId, coveredAmount, dsc }
  const res = await api.post(`/api/v1/debts/${debtId}/allocations`, payload);
  return res.data;
}

export async function updateAllocation(debtId, allocationId, payload) {
  // payload: { transactionId, coveredAmount, dsc }
  const res = await api.put(`/api/v1/debts/${debtId}/allocations/${allocationId}`, payload);
  return res.data;
}

export async function deleteAllocation(debtId, allocationId) {
  const res = await api.delete(`/api/v1/debts/${debtId}/allocations/${allocationId}`);
  return res.data;
}

// ALL transactions in same project for this debt (for create/edit)
// GET /api/v1/debts/{debtId}/allocation-candidates/transactions?allocationId=123
export async function listTransactionCandidatesForDebt(debtId, { allocationId = null } = {}) {
  const res = await api.get(`/api/v1/debts/${debtId}/allocation-candidates/transactions`, {
    params: allocationId ? { allocationId } : {},
  });
  return res.data;
}
