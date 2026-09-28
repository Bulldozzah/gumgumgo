import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Clock, ScanBarcode, Search, Store } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { money, ProductRow, storeName, StoreRow } from "@/lib/helpers";
import { Section, Spinner } from "@/components/ui";
import BarcodeScanner from "@/components/BarcodeScanner";

interface ExistingPrice {
  price: number;
  verified: boolean;
  source: string;
  in_stock: boolean;
}

/**
 * Shopper price submission — scan or type a GTIN, see the store's current
 * price, and submit an updated price (goes in unverified, source "shopper",
 * until the store owner re-verifies).
 */
const ScanPanel = ({ currencySymbol, stores }: { currencySymbol: string; stores: StoreRow[] }) => {
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [manualGtin, setManualGtin] = useState("");
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [existingPrice, setExistingPrice] = useState<ExistingPrice | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;

  const loadExistingPrice = async (gtin: string, storeId: string) => {
    const { data } = await supabase
      .from("store_prices")
      .select("price, verified, source, in_stock")
      .eq("store_id", storeId)
      .eq("product_gtin", gtin)
      .maybeSingle();
    setExistingPrice(data as ExistingPrice | null);
  };

  const lookupProduct = async (gtin: string) => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("gtin", gtin.trim())
      .maybeSingle();

    if (!data) {
      toast.error(`No product with barcode ${gtin} in the catalog`);
      setProduct(null);
      setExistingPrice(null);
      return;
    }
    setProduct(data as ProductRow);
    if (selectedStoreId) await loadExistingPrice(data.gtin, selectedStoreId);
  };

  const handleScan = (code: string) => {
    setScanning(false);
    setManualGtin(code);
    lookupProduct(code);
  };

  const submitPrice = async () => {
    if (!selectedStore || !product) {
      toast.error("Select a store and look up a product first");
      return;
    }
    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error("Enter a valid price greater than zero");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsSubmitting(true);
    const { error } = await supabase
      .from("store_prices")
      .upsert(
        {
          store_id: selectedStore.id,
          product_gtin: product.gtin,
          price: parsedPrice,
          in_stock: true,
          verified: false,
          source: "shopper",
          updated_by: user.id,
        },
        { onConflict: "store_id,product_gtin" }
      );
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${money(currencySymbol, parsedPrice)} submitted for review`);
      setNewPrice("");
      await loadExistingPrice(product.gtin, selectedStore.id);
    }
  };

  return (
    <Section
      title="Scan a price"
      subtitle="Spotted a different price in-store? Scan the barcode and submit it — the store owner will verify it."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Store you're in</label>
            <select
              className="field"
              value={selectedStoreId}
              onChange={(e) => {
                setSelectedStoreId(e.target.value);
                if (product && e.target.value) loadExistingPrice(product.gtin, e.target.value);
              }}
            >
              <option value="">Select store…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {storeName(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Product barcode (GTIN)</label>
            <div className="flex gap-2">
              <input
                className="field"
                placeholder="e.g. 6009711320432"
                value={manualGtin}
                onChange={(e) => setManualGtin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupProduct(manualGtin)}
              />
              <button onClick={() => lookupProduct(manualGtin)} className="btn-secondary btn-md">
                <Search className="h-4 w-4" />
              </button>
              <button onClick={() => setScanning(true)} className="btn-primary btn-md">
                <ScanBarcode className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-canvas p-5">
          {product ? (
            <>
              <p className="font-bold">{product.description}</p>
              <p className="text-xs text-ink-faint">GTIN {product.gtin}</p>

              {selectedStore && (
                <div className="mt-3 rounded-lg border border-line bg-white p-3 text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-ink-muted">
                    <Store className="h-3.5 w-3.5" /> {storeName(selectedStore)}
                  </p>
                  {existingPrice ? (
                    <p className="mt-1.5 flex items-center gap-2">
                      <span className="text-lg font-bold">
                        {money(currencySymbol, Number(existingPrice.price))}
                      </span>
                      {existingPrice.verified ? (
                        <span className="chip bg-brand-tint text-brand-darker">
                          <BadgeCheck className="h-3 w-3" /> Verified
                        </span>
                      ) : (
                        <span className="chip bg-amber-50 text-amber-600">
                          <Clock className="h-3 w-3" /> Awaiting verification
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-ink-faint">No price recorded here yet.</p>
                  )}
                </div>
              )}

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-semibold">
                  Price you see ({currencySymbol})
                </label>
                <div className="flex gap-2">
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                  />
                  <button onClick={submitPrice} disabled={isSubmitting} className="btn-primary btn-md shrink-0">
                    {isSubmitting && <Spinner />}
                    Submit
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center text-ink-faint">
              <ScanBarcode className="mb-2 h-10 w-10" />
              <p className="text-sm font-medium">Scan or enter a barcode to see the product here.</p>
            </div>
          )}
        </div>
      </div>

      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onScan={handleScan} />
    </Section>
  );
};

export default ScanPanel;
