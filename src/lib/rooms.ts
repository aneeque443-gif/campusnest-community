export const SLOTS = [
  { key: "9-11" as const, label: "9:00 AM – 11:00 AM", startHour: 9 },
  { key: "11-13" as const, label: "11:00 AM – 1:00 PM", startHour: 11 },
  { key: "14-16" as const, label: "2:00 PM – 4:00 PM", startHour: 14 },
  { key: "16-18" as const, label: "4:00 PM – 6:00 PM", startHour: 16 },
];

export type SlotKey = (typeof SLOTS)[number]["key"];

export function slotStart(date: string, slot: SlotKey): Date {
  const meta = SLOTS.find((s) => s.key === slot)!;
  const d = new Date(`${date}T00:00:00`);
  d.setHours(meta.startHour, 0, 0, 0);
  return d;
}

export function canCancel(date: string, slot: SlotKey): boolean {
  return slotStart(date, slot).getTime() - Date.now() > 60 * 60 * 1000;
}