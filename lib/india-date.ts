const INDIA_TIME_ZONE = "Asia/Kolkata";

export function getDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-IN", {
        timeZone: INDIA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateKey: string) {
    const [year, month, day] = dateKey.split("-");

    return `${day}/${month}/${year}`;
}

export function formatPunchTime(timestamp: Date | string) {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: INDIA_TIME_ZONE,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(timestamp));
}
