import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a blood-pressure pair for display. A 0 (or missing) systolic means
 * "no reading yet" — show an em-dash rather than a misleading "0/0".
 */
export function formatBp(systolic?: number | null, diastolic?: number | null): string {
  if (!systolic || systolic <= 0) return '—';
  return `${systolic}/${diastolic ?? 0}`;
}
