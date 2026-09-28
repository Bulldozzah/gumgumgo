import { Capacitor } from "@capacitor/core";
import { countries } from "./countries";

export type AppRole = "admin" | "store_owner" | "shopper" | "super_admin";

export interface StoreRow {
  id: string;
  location: string;
  hq_id: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
  contact?: string | null;
  whatsapp?: string | null;
  store_owner_id?: string | null;
  store_hq?: { name: string } | null;
  created_at?: string | null;
}

export interface ProductRow {
  gtin: string;
  description: string;
}

export interface ShoppingListRow {
  id: string;
  name: string;
  budget: number | null;
  assigned_store_id: string | null;
  user_id: string;
  created_at: string;
}

export interface ListItemRow {
  id: string;
  shopping_list_id: string;
  product_gtin: string;
  quantity: number;
  products?: { description: string } | null;
  price?: number;
  in_stock?: boolean;
  verified?: boolean;
}

export interface ProfileRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  country: string | null;
  currency: string | null;
  phone: string | null;
  phone_area_code: string | null;
  whatsapp: string | null;
  contact: string | null;
  profile_completed: boolean | null;
}

export function storeName(store: StoreRow | null | undefined): string {
  if (!store) return "";
  return `${store.store_hq?.name ?? "Store"} — ${store.location}`;
}

/**
 * Open the store's location in the user's map app. On Android this fires a
 * geo: intent, so Google Maps, Waze and delivery apps that handle geo URIs can
 * claim it; on the web it falls back to Google Maps in a new tab.
 */
export function openStoreMap(store: StoreRow): void {
  const label = storeName(store);
  const hasCoords = store.latitude != null && store.longitude != null;
  const query = store.address || [label, store.city].filter(Boolean).join(", ");

  if (Capacitor.isNativePlatform()) {
    const geoUri = hasCoords
      ? `geo:${store.latitude},${store.longitude}?q=${store.latitude},${store.longitude}(${encodeURIComponent(label)})`
      : `geo:0,0?q=${encodeURIComponent(query)}`;
    // Capacitor launches non-http(s) schemes as ACTION_VIEW intents.
    window.location.href = geoUri;
  } else {
    const mapsQuery = hasCoords ? `${store.latitude},${store.longitude}` : query;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
      "_blank"
    );
  }
}

export function currencySymbolFor(currencyCode: string | null | undefined): string {
  if (!currencyCode) return "$";
  const country = countries.find((c) => c.currencyCode === currencyCode);
  return country?.currencySymbol ?? "$";
}

export function money(symbol: string, value: number): string {
  return `${symbol} ${value.toFixed(2)}`;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Haversine distance in km — same formula as the original auto-check feature.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
