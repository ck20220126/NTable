const DATE_ONLY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Date field display text. Values stay raw (ISO strings sort correctly as text); only the shown text is shortened:
 * the year is dropped when it equals the current year, and times show hours and minutes without seconds.
 * Date-only strings (YYYY-MM-DD) are read as calendar dates rather than UTC instants, so they never shift a day.
 * Unparseable values are shown as they are.
 */
export function formatDateValue(value: unknown, now: Date = new Date()): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const dateOnly = DATE_ONLY.exec(value.trim());
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      const monthDay = `${Number(month)}/${Number(day)}`;
      return Number(year) === now.getFullYear() ? monthDay : `${year}/${monthDay}`;
    }
  }
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return String(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
  const day = date.getFullYear() === now.getFullYear() ? monthDay : `${date.getFullYear()}/${monthDay}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
