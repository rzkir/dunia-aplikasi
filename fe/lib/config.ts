// Konfigurasi base URL API backend
// NEXT_PUBLIC_API_URL bisa di-set di .env.local, contoh:
// NEXT_PUBLIC_API_URL=http://127.0.0.1:8787

const rawBase =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL || "" : "";

export const API_BASE_URL = rawBase.replace(/\/+$/, "");
