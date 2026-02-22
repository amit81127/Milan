import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp: number) {
    const date = new Date(timestamp);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();
    const isSameYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isSameYear) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }
}
