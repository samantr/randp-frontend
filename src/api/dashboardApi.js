import api from "./axios";

export async function refreshDashboardMart() {
  const res = await api.post("/api/v1/dashboard/refresh");
  return res.data;
}

export async function getLastRefresh() {
  const res = await api.get("/api/v1/dashboard/last-refresh");
  return res.data;
}

export async function getDashboardSummary({ from, to }) {
  const res = await api.get("/api/v1/dashboard/summary", { params: { from, to } });
  return res.data;
}

export async function getDashboardCashflow({ from, to }) {
  const res = await api.get("/api/v1/dashboard/cashflow", { params: { from, to } });
  return res.data;
}

export async function getTopPayers({ from, to, limit = 10 }) {
  const res = await api.get("/api/v1/dashboard/top-payers", { params: { from, to, limit } });
  return res.data;
}

export async function getTopReceivers({ from, to, limit = 10 }) {
  const res = await api.get("/api/v1/dashboard/top-receivers", { params: { from, to, limit } });
  return res.data;
}

export async function getPersonsSummary({ from, to, limit = 50 }) {
  const res = await api.get("/api/v1/dashboard/persons-summary", { params: { from, to, limit } });
  return res.data;
}

export async function getPersonPayables({ personId, from, to, limit = 50 }) {
  const res = await api.get(`/api/v1/dashboard/persons/${personId}/payables`, {
    params: { from, to, limit },
  });
  return res.data;
}

/* ====== DRILLS ====== */
export async function getProjectsSummary({ from, to, limit = 50 }) {
  const res = await api.get("/api/v1/dashboard/projects-summary", { params: { from, to, limit } });
  return res.data;
}

export async function getProjectCategories({ projectId, from, to, limit = 30 }) {
  const res = await api.get(`/api/v1/dashboard/projects/${projectId}/categories`, {
    params: { from, to, limit },
  });
  return res.data;
}

export async function getProjectItems({ projectId, itemCategoryId, from, to, limit = 50 }) {
  const res = await api.get(`/api/v1/dashboard/projects/${projectId}/items`, {
    params: { from, to, limit, itemCategoryId: itemCategoryId ?? undefined },
  });
  return res.data;
}

export async function getItemCategoriesSummary({ from, to, limit = 50 }) {
  const res = await api.get("/api/v1/dashboard/item-categories-summary", {
    params: { from, to, limit },
  });
  return res.data;
}

export async function getItemsByCategory({ itemCategoryId, from, to, limit = 50 }) {
  const res = await api.get(`/api/v1/dashboard/item-categories/${itemCategoryId}/items`, {
    params: { from, to, limit },
  });
  return res.data;
}


export async function getDebtAgingByPerson({ from, to, asOf, limit = 50 }) {
  const res = await api.get("/api/v1/dashboard/debt-aging/persons", {
    params: { from, to, asOf, limit },
  });
  return res.data;
}

export async function getItemCategoriesTree({ from, to, onlyActive = true }) {
  const res = await api.get("/api/v1/dashboard/item-categories-tree", {
    params: { from, to, onlyActive },
  });
  return res.data;
}


export async function downloadPersonOperationsExcel({
  personId,
  displayName,
  from,
  to,
}) {
  const res = await api.get(`/api/v1/reports/persons/${personId}/operations.xlsx`, {
    params: { from, to },
    responseType: "blob",
  });

  const blob = new Blob([res.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");

  const safeName = String(displayName || "person")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();

  a.href = url;
  a.download = `گزارش عملیات ${safeName}.xlsx`;
  document.body.appendChild(a);
  a.click();

  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function getUnallocatedOverview({
  from,
  to,
  limit = 50,
}) {
  const res = await api.get("/api/v1/dashboard/unallocated", {
    params: { from, to, limit },
  });

  return res.data;
}