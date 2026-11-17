/** Convert local form dates only at the UI boundary; API plans always use UTC. */
export function localDateValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
export function datedAvailability(labels: string[], now = new Date()) {
  const windows: { start: Date; end: Date }[] = [];
  for (let day = 1; day <= 14; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    for (const label of labels) {
      const hours =
        label === "Weekends" && weekend
          ? [9, 22]
          : !weekend
            ? (
                {
                  "Weekday mornings": [9, 12],
                  "Weekday afternoons": [12, 18],
                  "Weekday evenings": [18, 22],
                } as Record<string, number[]>
              )[label]
            : undefined;
      if (!hours) continue;
      const start = new Date(date),
        end = new Date(date);
      start.setHours(hours[0]!, 0, 0, 0);
      end.setHours(hours[1]!, 0, 0, 0);
      windows.push({ start, end });
    }
  }
  return windows;
}
export const categoryNames: Record<string, string> = {
  MUSIC: "Music",
  GAMES: "Games",
  OUTDOOR: "Outdoors",
  SPORT: "Sports",
  ART: "Arts & culture",
};
export function activityImage(category: string) {
  return category === "Outdoors"
    ? "/images/photo-1682373440063-43e7260256be.jpg"
    : category === "Sports"
      ? "/images/photo-1564769662533-4f00a87b4056.jpg"
      : "/images/photo-1737562815369-78d3ee4d58aa.jpg";
}
export function statusLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}
export function formText(data: FormData, key: string, fallback = "") {
  const value = data.get(key);
  return typeof value === "string" ? value : fallback;
}
