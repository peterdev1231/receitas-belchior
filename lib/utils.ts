import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function validateVideoUrl(url: string): boolean {
  const patterns = [
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
    /^(https?:\/\/)?([\w-]+\.)?tiktok\.com\/.+$/, // Aceita qualquer subdomínio (vm., vt., www., etc.)
    /^(https?:\/\/)?(www\.)?instagram\.com\/.+$/,
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

