const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function getAvailableTimezones(): string[] {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  if (typeof supportedValuesOf === "function") {
    try {
      return supportedValuesOf("timeZone");
    } catch {
      return FALLBACK_TIMEZONES;
    }
  }
  return FALLBACK_TIMEZONES;
}

export const TIMEZONES = getAvailableTimezones();
export const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Converts a date+time picked in a given IANA timezone into a UTC ISO string, correctly
 * accounting for that zone's offset (including DST) at that specific date -- computed via
 * the standard "double format" trick rather than a timezone library. */
export function zonedTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(asUtc));

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const asIfLocal = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    map.hour === "24" ? 0 : Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  const offset = asIfLocal - asUtc;
  return new Date(asUtc - offset).toISOString();
}

/** Reverse of zonedTimeToUtcIso -- for redisplaying a stored UTC instant as date/time
 * fields in a given timezone (e.g. when editing an existing scheduled post). */
export function utcIsoToZonedParts(isoString: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoString));

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour === "24" ? "00" : map.hour}:${map.minute}`,
  };
}
