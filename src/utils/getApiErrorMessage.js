export function getApiErrorMessage(err, fallback = "خطا") {
  const data = err?.response?.data;

  // our backend standard: { code, message, details? }
  if (data?.message) return data.message;

  // some backends return string
  if (typeof data === "string" && data.trim()) return data;

  // axios network errors
  if (err?.message === "Network Error") return "ارتباط با سرور برقرار نشد.";

  return fallback;
}
