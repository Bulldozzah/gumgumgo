import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  MapPin,
  PackageSearch,
  ScanBarcode,
  Search,
  Share2,
  ShoppingCart,
  Store,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  money,
  openStoreMap,
  ProductRow,
  ShoppingListRow,
  storeName,
  StoreRow,
} from "@/lib/helpers";
import { shareTextOrCopy } from "@/lib/share";
import { EmptyState, Modal, Section, Spinner } from "@/components/ui";
import BarcodeScanner from "@/components/BarcodeScanner";

interface StorePriceResult {
  product_gtin: string;
  description: string;
  price: number;
  in_stock: boolean;
  verified: boolean;
  unverified_price?: number | null;
}

interface Props {
  currencySymbol: string;
  shoppingLists: ShoppingListRow[];
  refresh: () => Promise<void>;
}

/**
 * Virtual store browsing — ported from the WiseUp Android BrowseStoreScreen.
 * Pick a store, then search or scan products to see that store's prices,
 * add items to a list, share a list assigned to the store, or open its map.
 */
const BrowseStorePanel = ({ currencySymbol, shoppingLists, refresh }: Props) => {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [storeSearch, setStoreSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState<StoreRow | null>(null);

  const [productSearch, setProductSearch] = useState("");
  const [results, setResults] = useState<StorePriceResult[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [addToList, setAddToList] = useState<StorePriceResult | null>(null);
  const [addListId, setAddListId] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("stores").select("*, store_hq(name)");
      setStores((data as StoreRow[]) || []);
      setLoadingStores(false);
    })();
  }, []);

  const searchProducts = async (store: StoreRow, term: string) => {
    const q = term.trim();
    if (!q) return;
    setLoadingProducts(true);
    setHasSearched(true);

    const { data: products } = await supabase
      .from("products")
      .select("*")
      .or(`gtin.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(100);
    const productMap: Record<string, ProductRow> = {};
    for (const p of (products as ProductRow[]) ?? []) productMap[p.gtin] = p;

    let found: StorePriceResult[] = [];
    const gtins = Object.keys(productMap);
    if (gtins.length > 0) {
      const { data: prices } = await supabase
        .from("store_prices")
        .select("product_gtin, price, in_stock, verified, unverified_price")
        .eq("store_id", store.id)
        .in("product_gtin", gtins);
      found = ((prices as StorePriceResult[]) ?? []).map((p) => ({
        ...p,
        description: productMap[p.product_gtin]?.description ?? p.product_gtin,
      }));
    }
    setResults(found);
    setLoadingProducts(false);
  };

  const handleScan = (code: string) => {
    setScanning(false);
    setProductSearch(code);
    if (selectedStore) searchProducts(selectedStore, code);
  };

  const openStore = (store: StoreRow) => {
    setSelectedStore(store);
    setProductSearch("");
    setResults([]);
    setHasSearched(false);
  };

  const closeStore = () => {
    setSelectedStore(null);
    setProductSearch("");
    setResults([]);
    setHasSearched(false);
  };

  const addItemToList = async () => {
    if (!addToList || !addListId) return;
    const { error } = await supabase.from("shopping_list_items").insert({
      shopping_list_id: addListId,
      product_gtin: addToList.product_gtin,
      quantity: 1,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`${addToList.description} added to list`);
      await refresh();
    }
    setAddToList(null);
    setAddListId("");
  };

  // Same share format as the WiseUp Android app's Browse Store screen.
  const shareAssignedList = async (list: ShoppingListRow, store: StoreRow) => {
    setShareOpen(false);
    const { data } = await supabase
      .from("shopping_list_items")
      .select("*, products(description)")
      .eq("shopping_list_id", list.id);
    const items =
      (data as { product_gtin: string; quantity: number; products?: { description: string } | null }[]) ||
      [];

    const priceMap: Record<string, { price: number; in_stock: boolean }> = {};
    if (items.length > 0) {
      const { data: prices } = await supabase
        .from("store_prices")
        .select("product_gtin, price, in_stock")
        .eq("store_id", store.id)
        .in("product_gtin", items.map((i) => i.product_gtin));
      for (const p of prices ?? []) priceMap[p.product_gtin] = p;
    }

    let inStockTotal = 0;
    const lines = items.map((item, idx) => {
      const p = priceMap[item.product_gtin];
      if (p?.in_stock) inStockTotal += Number(p.price) * item.quantity;
      let line = `${idx + 1}. ${item.products?.description ?? item.product_gtin}  x${item.quantity}`;
      if (p) line += ` @ ${money(currencySymbol, Number(p.price))}${p.in_stock ? " ✓" : " ✗"}`;
      return line;
    });

    const header = [`🛒 ${list.name}`, `Store: ${storeName(store)}`];
    if (store.address) header.push(`Address: ${store.address}`);
    if (store.city && !(store.address ?? "").toLowerCase().includes(store.city.toLowerCase())) {
      header.push(`City: ${store.city}`);
    }
    if (list.budget != null) header.push(`Budget: ${money(currencySymbol, Number(list.budget))}`);

    const text = [
      ...header,
      "────────────────",
      ...lines,
      "────────────────",
      `Total (in-stock): ${money(currencySymbol, inStockTotal)}`,
      "Shared from gumgumgo",
    ].join("\n");

    const outcome = await shareTextOrCopy(list.name, text);
    if (outcome === "copied") toast.success("Sharing unavailable — list copied to clipboard");
    else if (outcome === "failed") toast.error("Could not share the list");
  };

  // ======== STORE PICKER ========
  if (!selectedStore) {
    const filtered = stores.filter((s) => {
      const q = storeSearch.trim().toLowerCase();
      return (
        !q ||
        storeName(s).toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q)
      );
    });

    return (
      <Section
        title="Browse a store"
        subtitle="Pick a store to shop its catalog with live prices and stock."
      >
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            className="field pl-9"
            placeholder="Search stores by name, location or city…"
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
          />
        </div>

        {loadingStores ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Store className="h-10 w-10" />}
            title="No stores found"
            hint="Try a different search term."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((store) => (
              <div key={store.id} className="card-hover flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint">
                  <Store className="h-5 w-5 text-brand-darker" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{storeName(store)}</p>
                  {store.address && (
                    <p className="truncate text-xs text-ink-faint">{store.address}</p>
                  )}
                  {store.city && (
                    <p className="truncate text-xs text-ink-faint">{store.city}</p>
                  )}
                </div>
                <button onClick={() => openStore(store)} className="btn-primary btn-sm shrink-0">
                  <ShoppingCart className="h-3.5 w-3.5" /> Shop
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
    );
  }

  // ======== VIRTUAL STORE ========
  const store = selectedStore;
  const assignedLists = shoppingLists.filter((l) => l.assigned_store_id === store.id);
  const cheapest =
    results.length > 1 ? Math.min(...results.map((r) => Number(r.price))) : null;

  return (
    <div className="space-y-4">
      {/* Store header */}
      <div className="card flex items-center gap-3 bg-brand-tint/60 p-4">
        <button onClick={closeStore} className="btn-ghost h-9 w-9 rounded-full p-0" aria-label="Back to stores">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink-heading">{storeName(store)}</p>
          {store.address && <p className="truncate text-xs text-ink-muted">{store.address}</p>}
          {store.city && !(store.address ?? "").toLowerCase().includes(store.city.toLowerCase()) && (
            <p className="truncate text-xs text-ink-muted">{store.city}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setShareOpen(true)} className="btn-secondary btn-sm" title="Share a list assigned to this store">
            <Share2 className="h-3.5 w-3.5" /> Share list
          </button>
          <button onClick={() => openStoreMap(store)} className="btn-secondary btn-sm" title="Open store location in a map app">
            <MapPin className="h-3.5 w-3.5" /> Map
          </button>
        </div>
      </div>

      <Section
        title={`Shop at ${store.store_hq?.name ?? "this store"}`}
        subtitle="Search the catalog or scan a barcode to see this store's prices."
      >
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              className="field pl-9"
              placeholder="Search by product name or barcode…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchProducts(store, productSearch)}
            />
          </div>
          <button onClick={() => searchProducts(store, productSearch)} className="btn-secondary btn-md">
            <Search className="h-4 w-4" />
          </button>
          <button onClick={() => setScanning(true)} className="btn-primary btn-md">
            <ScanBarcode className="h-4 w-4" />
            <span className="hidden sm:inline">Scan</span>
          </button>
        </div>

        {loadingProducts ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="h-10 w-10" />}
            title={
              hasSearched
                ? `No products match "${productSearch}" at this store`
                : "Search or scan to browse this store"
            }
            hint={
              hasSearched
                ? "Try another term — only products priced at this store appear here."
                : "Products with prices at this store will show up here."
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => {
              const isCheapest = cheapest != null && Number(r.price) === cheapest;
              const communityDiffers =
                r.verified && r.unverified_price != null && Number(r.unverified_price) !== Number(r.price);
              return (
                <div
                  key={r.product_gtin}
                  className={`card p-4 ${isCheapest ? "border-brand ring-1 ring-brand" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">{r.description}</p>
                      <p className="text-xs text-ink-faint">GTIN {r.product_gtin}</p>
                    </div>
                    {isCheapest && (
                      <span className="chip shrink-0 bg-brand-tint text-brand-darker">Cheapest</span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-lg font-bold">
                      {money(currencySymbol, Number(r.price))}
                      {r.verified && (
                        <BadgeCheck className="h-4 w-4 text-brand" aria-label="Verified price" />
                      )}
                    </span>
                    {r.in_stock ? (
                      <span className="chip bg-brand-tint text-brand-darker">
                        <CheckCircle2 className="h-3 w-3" /> In stock
                      </span>
                    ) : (
                      <span className="chip bg-red-50 text-red-600">
                        <XCircle className="h-3 w-3" /> Out
                      </span>
                    )}
                  </div>

                  {r.unverified_price != null && (
                    <p className="mt-1 text-xs text-ink-muted">
                      Community price:{" "}
                      <span className="font-semibold text-red-600">
                        {money(currencySymbol, Number(r.unverified_price))}
                      </span>
                    </p>
                  )}
                  {communityDiffers && (
                    <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      Price difference detected — you may be overpaying
                    </p>
                  )}

                  <button
                    onClick={() => {
                      setAddToList(r);
                      setAddListId("");
                    }}
                    className="btn-primary btn-sm mt-3"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" /> Add to list
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onScan={handleScan} />

      {/* Share list picker — only lists assigned to this store */}
      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share shopping list">
        {assignedLists.length === 0 ? (
          <p className="py-4 text-sm text-ink-muted">
            No shopping lists are assigned to this store. Assign one from the My Lists tab first.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-muted">
              Lists assigned to {store.store_hq?.name ?? "this store"}:
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {assignedLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => shareAssignedList(list, store)}
                  className="flex w-full items-center gap-2 rounded-lg border border-line p-3 text-left text-sm font-semibold hover:border-brand hover:bg-brand-tint"
                >
                  <ShoppingCart className="h-4 w-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{list.name}</span>
                    {list.budget != null && (
                      <span className="block text-xs font-normal text-ink-faint">
                        Budget: {money(currencySymbol, Number(list.budget))}
                      </span>
                    )}
                  </span>
                  <Share2 className="h-4 w-4 shrink-0 text-brand" />
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Add to list picker */}
      <Modal
        open={addToList !== null}
        onClose={() => {
          setAddToList(null);
          setAddListId("");
        }}
        title="Add to shopping list"
      >
        <p className="mb-3 text-sm font-semibold text-ink-heading">{addToList?.description}</p>
        {shoppingLists.length === 0 ? (
          <p className="py-2 text-sm text-ink-muted">
            No shopping lists found. Create one from the My Lists tab first.
          </p>
        ) : (
          <>
            <div className="max-h-60 space-y-1.5 overflow-y-auto">
              {shoppingLists.map((list) => (
                <label
                  key={list.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"
                >
                  <input
                    type="radio"
                    name="add-to-list"
                    className="accent-brand"
                    checked={addListId === list.id}
                    onChange={() => setAddListId(list.id)}
                  />
                  {list.name}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn-secondary btn-md"
                onClick={() => {
                  setAddToList(null);
                  setAddListId("");
                }}
              >
                Cancel
              </button>
              <button className="btn-primary btn-md" onClick={addItemToList} disabled={!addListId}>
                Add
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default BrowseStorePanel;
