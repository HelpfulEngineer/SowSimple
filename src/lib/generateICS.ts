type CalendarEvent = {
  title: string;
  description?: string;
  startDate: Date;
};

function formatDateUTC(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function escapeICSValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function createEvent(event: CalendarEvent) {
  const uid = `${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}@sow-simple`;
  const dtstamp = `${formatDateUTC(new Date())}T000000Z`;
  const dtstart = formatDateUTC(event.startDate);

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `SUMMARY:${escapeICSValue(event.title)}`,
    `DESCRIPTION:${escapeICSValue(event.description ?? "")}`,
    "END:VEVENT"
  ].join("\r\n");
}

export function generateICSFile(_filename: string, events: CalendarEvent[]) {
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sow Simple//EN",
    ...events.map(createEvent),
    "END:VCALENDAR"
  ].join("\r\n");

  return new Blob([body], { type: "text/calendar;charset=utf-8" });
}

export function downloadICS(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
