import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, PackageSearch, Plus, ScanBarcode, Search, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { debounce, ListItemRow, ProductRow, ShoppingListRow } from "@/lib/helpers";
import { EmptyState, Section } from "@/components/ui";
import BarcodeScanner from "@/components/BarcodeScanner";

interface Props {
  shoppingLists: ShoppingListRow[];
  selectedListId: string;
  setSelectedListId: (id: string) => void;
  listItems: ListItemRow[];
  refresh: () => Promise<void>;
}

const ProductsPanel = ({
  shoppingLists,
  selectedListId,
  setSelectedListId,
  listItems,
  refresh,
}: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [scanning, setScanning] = useState(false);

  const searchProducts = async (term: string) => {
    let query = supabase.from("products").select("*");
    if (term.trim()) {
      query = query.or(`gtin.ilike.%${term}%,description.ilike.%${term}%`);
    }
    const { data } = await query.limit(100);
    setProducts((data as ProductRow[]) || []);
  };

  const debouncedSearch = useMemo(() => debounce(searchProducts, 300), []);

  useEffect(() => {
    searchProducts("");
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    debouncedSearch(value);
  };

  const handleScan = (code: string) => {
    setScanning(false);
    setSearchTerm(code);
    searchProducts(code);
  };

  const bumpQuantity = (gtin: string, delta: number) => {
    if (!selectedListId) {
      toast.error("Select or create a shopping list first");
      return;
    }
    setQuantities((p) => ({ ...p, [gtin]: Math.max(0, (p[gtin] || 0) + delta) }));
  };

  const addToList = async (gtin: string) => {
    if (!selectedListId) {
      toast.error("Select or create a shopping list first");
      return;
    }
    const quantity = quantities[gtin] || 0;
    if (quantity === 0) {
      toast.error("Set a quantity greater than 0 to add");
      return;
    }
    if (listItems.some((i) => i.product_gtin === gtin)) {
      toast.info("Product already in list");
      return;
    }

    const { error } = await supabase
      .from("shopping_list_items")
      .insert({ shopping_list_id: selectedListId, product_gtin: gtin, quantity });

    if (error) toast.error(error.message);
    else {
      toast.success("Added to list");
      setQuantities((p) => ({ ...p, [gtin]: 0 }));
      await refresh();
    }
  };

  return (
    <Section
      title="Find products"
      subtitle="Search the catalog by name or GTIN, set a quantity, and add to your active list."
      actions={
        <select
          className="field w-56"
          value={selectedListId}
          onChange={(e) => setSelectedListId(e.target.value)}
        >
          <option value="">Choose active list…</option>
          {shoppingLists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      }
    >
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            className="field pl-9"
            placeholder="Search by product name or barcode…"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <button onClick={() => setScanning(true)} className="btn-secondary btn-md">
          <ScanBarcode className="h-4 w-4" />
          <span className="hidden sm:inline">Scan</span>
        </button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-10 w-10" />}
          title="No products found"
          hint="Try a different search term or scan a barcode."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const inList = listItems.some((i) => i.product_gtin === product.gtin);
            const qty = quantities[product.gtin] || 0;
            return (
              <div key={product.gtin} className="card-hover flex flex-col justify-between p-4">
                <div>
                  <p className="font-semibold leading-snug text-ink-heading">
                    {product.description}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">GTIN {product.gtin}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => bumpQuantity(product.gtin, -1)}
                      className="btn-ghost h-8 w-8 rounded-full p-0"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center font-semibold">{qty}</span>
                    <button
                      onClick={() => bumpQuantity(product.gtin, 1)}
                      className="btn-ghost h-8 w-8 rounded-full p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {inList ? (
                    <span className="chip bg-brand-tint text-brand-darker">In list</span>
                  ) : (
                    <button
                      onClick={() => addToList(product.gtin)}
                      className="btn-primary btn-sm"
                      disabled={qty === 0}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" /> Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onScan={handleScan} />
    </Section>
  );
};

export default ProductsPanel;
