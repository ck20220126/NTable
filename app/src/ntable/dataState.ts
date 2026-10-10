export function tableDataState(rowCount: number, displayedCount: number, loading: boolean, error: string | null | undefined) {
  if (loading) return rowCount ? "refreshing" : "loading";
  if (error) return rowCount ? "refreshError" : "error";
  if (!rowCount) return "empty";
  return displayedCount ? "ready" : "noResults";
}
