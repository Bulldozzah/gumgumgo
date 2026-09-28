import { useState } from "react";
import { toast } from "sonner";
import { Crosshair, MapPin, Scale, Store, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  haversineKm,
  ListItemRow,
  money,
  ShoppingListRow,
  storeName,
  StoreRow,
} from "@/lib/helpers";
import { EmptyState, Section, Spinner } from "@/components/ui";

interface CompareResult {
  store: StoreRow;
  prices: { product_gtin: string; price: number; in_stock: boolean }[];
  total: number;
  distance?: number;
}

interface Props {
  currencySymbol: string;
  stores: StoreRow[];
  shoppingLists: ShoppingListRow[];
  selectedListId: string;
  setSelectedListId: (id: string) => void;
  listItems: ListItemRow[];
}

const ComparePanel = ({
  currencySymbol,
  stores,
  shoppingLists,
  selectedListId,
  setSelectedListId,
  listItems,
}: Props) => {
  const [compareStores, setCompareStores] = useState<string[]>([]);
  const [comparison, setComparison] = useState<CompareResult[] | null>(null);
  const [isAutoChecking, setIsAutoChecking] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  const toggleStore = (storeId: string) => {
    setCompareStores((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : prev.length >= 2
          ? prev
          : [...prev, storeId]
    );
  };

  const buildResult = async (
    storeId: string,
    store?: StoreRow,
    distance?: number
  ): Promise<CompareResult> => {
    let storeRow = store;
    if (!storeRow) {
      const { data } = await supabase
        .from("stores")
        .select("*, store_hq(name)")
        .eq("id", storeId)
        .single();
      storeRow = data as StoreRow;
    }

    const gtins = listItems.map((i) => i.product_gtin);
    const { data: prices } = await supabase
      .from("store_prices")
      .select("product_gtin, price, in_stock")
      .eq("store_id", storeId)
      .in("product_gtin", gtins);

    const total =
      prices?.reduce((sum, p) => {
        const item = listItems.find((i) => i.product_gtin === p.product_gtin);
        return sum + Number(p.price) * (item?.quantity || 1);
      }, 0) || 0;

    return { store: storeRow!, prices: prices || [], total, distance };
  };

  const comparePrices = async () => {
    if (compareStores.length === 0 || compareStores.length > 2) {
      toast.error("Select 1 or 2 stores to compare");
      return;
    }
    if (!selectedListId || listItems.length === 0) {
      toast.error("Select a list with products to compare");
      return;
    }
    const results = await Promise.all(compareStores.map((id) => buildResult(id)));
    setComparison(results);
  };

  // Geolocate, find the 5 closest stores (Haversine), and compare the list there.
  const autoCheckPrices = async () => {
    if (!selectedListId || listItems.length === 0) {
      toast.error("Select a shopping list with items first");
      return;
    }
    setIsAutoChecking(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      });

      const { data: allStores, error } = await supabase
        .from("stores")
        .select("id, location, latitude, longitude, store_hq(name)")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (error || !allStores || allStores.length === 0) {
        toast.error("No stores with location data found");
        return;
      }

      const closest = (allStores as unknown as StoreRow[])
        .map((s) => ({
          ...s,
          distance: haversineKm(
            position.coords.latitude,
            position.coords.longitude,
            Number(s.latitude),
            Number(s.longitude)
          ),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);

      const results = await Promise.all(
        closest.map((s) => buildResult(s.id, s, s.distance))
      );

      setCompareStores(closest.map((s) => s.id));
      setComparison(results);
      toast.success(`Compared prices at the ${results.length} closest stores`);
    } catch (err) {
      const geoErr = err as GeolocationPositionError & { message?: string };
      if (geoErr.code === 1) toast.error("Please allow location access to use auto-check");
      else if (geoErr.code === 2) toast.error("Could not determine your location");
      else if (geoErr.code === 3) toast.error("Getting your location timed out. Try again.");
      else toast.error(geoErr.message || "Failed to auto-check prices");
    } finally {
      setIsAutoChecking(false);
    }
  };

  const filteredStores = stores.filter((s) =>
    storeName(s).toLowerCase().includes(storeSearch.toLowerCase())
  );

  const bestTotal =
    comparison && comparison.length > 1
      ? Math.min(...comparison.filter((r) => r.total > 0).map((r) => r.total))
      : null;

  return (
    <div className="space-y-6">
      <Section
        title="Compare your list across stores"
        subtitle="Pick up to 2 stores manually, or auto-check the 5 closest to you."
        actions={
          <div className="flex gap-2">
            <select
              className="field w-52"
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
            >
              <option value="">Choose list…</option>
              {shoppingLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <input
          className="field mb-3 max-w-sm"
          placeholder="Filter stores…"
          value={storeSearch}
          onChange={(e) => setStoreSearch(e.target.value)}
        />
        <div className="mb-4 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {filteredStores.map((store) => {
            const checked = compareStores.includes(store.id);
            return (
              <label
                key={store.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-semibold transition-colors ${
                  checked ? "border-brand bg-brand-tint" : "border-line hover:border-ink-faint"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStore(store.id)}
                  className="h-4 w-4 accent-brand"
                />
                <Store className="h-4 w-4 shrink-0 text-brand" />
                {storeName(store)}
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={comparePrices} className="btn-primary btn-md">
            <Scale className="h-4 w-4" /> Compare selected ({compareStores.length}/2)
          </button>
          <button
            onClick={autoCheckPrices}
            disabled={isAutoChecking}
            className="btn-secondary btn-md"
          >
            {isAutoChecking ? <Spinner className="h-4 w-4 border-ink/30 border-t-ink" /> : <Crosshair className="h-4 w-4" />}
            Auto-check nearest stores
          </button>
        </div>
      </Section>

      {comparison === null ? (
        <EmptyState
          icon={<Scale className="h-10 w-10" />}
          title="No comparison yet"
          hint="Select stores and hit Compare, or use Auto-check to scan stores near you."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {comparison.map((result) => {
            const isBest = bestTotal !== null && result.total === bestTotal && result.total > 0;
            return (
              <div
                key={result.store.id}
                className={`card p-5 ${isBest ? "border-brand ring-1 ring-brand" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{storeName(result.store)}</p>
                    {result.distance != null && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                        <MapPin className="h-3 w-3" /> {result.distance.toFixed(1)} km away
                      </p>
                    )}
                  </div>
                  {isBest && (
                    <span className="chip bg-brand text-white">
                      <Trophy className="h-3 w-3" /> Best
                    </span>
                  )}
                </div>
                <p className="mt-3 text-2xl font-extrabold text-ink-heading">
                  {money(currencySymbol, result.total)}
                </p>
                <p className="text-xs text-ink-muted">
                  {result.prices.length} of {listItems.length} items priced ·{" "}
                  {result.prices.filter((p) => p.in_stock).length} in stock
                </p>
                <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto border-t border-line pt-3 text-sm">
                  {listItems.map((item) => {
                    const p = result.prices.find((x) => x.product_gtin === item.product_gtin);
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-ink-muted">
                          {item.products?.description ?? item.product_gtin}
                          <span className="text-ink-faint"> ×{item.quantity}</span>
                        </span>
                        {p ? (
                          <span
                            className={`shrink-0 font-semibold ${p.in_stock ? "" : "text-red-500 line-through"}`}
                          >
                            {money(currencySymbol, Number(p.price) * item.quantity)}
                          </span>
                        ) : (
                          <span className="shrink-0 text-ink-faint">n/a</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ComparePanel;
