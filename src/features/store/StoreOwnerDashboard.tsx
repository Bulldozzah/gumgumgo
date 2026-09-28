import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Clock,
  Contact,
  FileSpreadsheet,
  MessageSquare,
  Search,
  Store,
  Tags,
  Upload,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  currencySymbolFor,
  debounce,
  money,
  ProductRow,
  storeName,
  StoreRow,
} from "@/lib/helpers";
import Shell from "@/components/Shell";
import { EmptyState, Modal, Section, Spinner, StarRating, Stat } from "@/components/ui";
import ProfileEditor from "@/components/ProfileEditor";

interface PriceState {
  price: string;
  inStock: boolean;
  verified: boolean;
  source: string;
  unverifiedPrice?: string;
}

interface FeedbackRow {
  id: string;
  rating: number;
  feedback_type: string;
  title: string | null;
  body: string;
  created_at: string;
}

interface CsvError {
  line: number;
  gtin: string;
  message: string;
}

const nav = [
  { key: "prices", label: "Prices & Stock", icon: <Tags className="h-4 w-4" /> },
  { key: "import", label: "Bulk Import", icon: <FileSpreadsheet className="h-4 w-4" /> },
  { key: "contact", label: "Store Contact", icon: <Contact className="h-4 w-4" /> },
  { key: "feedback", label: "Feedback", icon: <MessageSquare className="h-4 w-4" /> },
  { key: "profile", label: "Profile", icon: <UserRound className="h-4 w-4" /> },
];

const StoreOwnerDashboard = () => {
  const [view, setView] = useState("prices");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [displayName, setDisplayName] = useState("");
  const [profilePromptOpen, setProfilePromptOpen] = useState(false);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [priceState, setPriceState] = useState<Record<string, PriceState>>({});
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});

  const [storeContact, setStoreContact] = useState({ email: "", contact: "", whatsapp: "" });
  const [isSavingContact, setIsSavingContact] = useState(false);

  const [csvData, setCsvData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [csvErrors, setCsvErrors] = useState<CsvError[]>([]);
  const [importStats, setImportStats] = useState<{ success: number; failed: number } | null>(null);

  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);

  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) {
        if (!profile.profile_completed) setProfilePromptOpen(true);
        setCurrencySymbol(currencySymbolFor(profile.currency));
        setDisplayName(profile.display_name ?? "");
      }

      const { data } = await supabase
        .from("stores")
        .select("*, store_hq(name)")
        .eq("store_owner_id", user.id);
      const owned = (data as StoreRow[]) || [];
      setStores(owned);
      if (owned.length > 0) setSelectedStoreId(owned[0].id);
    })();
  }, []);

  // Shows the store's currently-priced products when there's no search term.
  const loadStoreProducts = useCallback(async (storeId: string) => {
    if (!storeId) return;
    const { data: storePriceData } = await supabase
      .from("store_prices")
      .select("product_gtin")
      .eq("store_id", storeId);

    if (storePriceData && storePriceData.length > 0) {
      const gtins = storePriceData.map((sp) => sp.product_gtin);
      const { data } = await supabase.from("products").select("*").in("gtin", gtins);
      setProducts((data as ProductRow[]) || []);
    } else {
      setProducts([]);
    }
  }, []);

  const loadStorePrices = useCallback(async (storeId: string) => {
    const { data } = await supabase.from("store_prices").select("*").eq("store_id", storeId);
    const map: Record<string, PriceState> = {};
    data?.forEach((p) => {
      map[p.product_gtin] = {
        price: String(p.price),
        inStock: p.in_stock ?? true,
        verified: p.verified ?? false,
        source: p.source ?? "store_owner",
        unverifiedPrice: p.unverified_price != null ? String(p.unverified_price) : undefined,
      };
    });
    setPriceState(map);
    setPriceEdits({});
  }, []);

  const loadStoreContact = useCallback(async (storeId: string) => {
    const { data } = await supabase
      .from("stores")
      .select("email, contact, whatsapp")
      .eq("id", storeId)
      .single();
    if (data) {
      setStoreContact({
        email: data.email || "",
        contact: data.contact || "",
        whatsapp: data.whatsapp || "",
      });
    }
  }, []);

  const loadFeedback = useCallback(async (storeId: string) => {
    const { data } = await supabase
      .from("store_feedback")
      .select("id, rating, feedback_type, title, body, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setFeedback((data as FeedbackRow[]) || []);
  }, []);

  useEffect(() => {
    if (!selectedStoreId) return;
    loadStorePrices(selectedStoreId);
    loadStoreContact(selectedStoreId);
    loadStoreProducts(selectedStoreId);
    loadFeedback(selectedStoreId);
  }, [selectedStoreId, loadStorePrices, loadStoreContact, loadStoreProducts, loadFeedback]);

  const searchProducts = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        await loadStoreProducts(selectedStoreId);
        return;
      }
      const { data } = await supabase
        .from("products")
        .select("*")
        .or(`gtin.ilike.%${term}%,description.ilike.%${term}%`)
        .limit(500);
      setProducts((data as ProductRow[]) || []);
    },
    [selectedStoreId, loadStoreProducts]
  );

  const debouncedSearch = useMemo(() => debounce(searchProducts, 300), [searchProducts]);

  const updatePrice = async (gtin: string) => {
    const raw = priceEdits[gtin] ?? priceState[gtin]?.price;
    if (!selectedStoreId || !raw) return;

    const parsedPrice = parseFloat(raw);
    if (isNaN(parsedPrice) || parsedPrice <= 0 || parsedPrice > 999999.99) {
      toast.error("Enter a valid price between 0.01 and 999,999.99");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("store_prices").upsert(
      {
        store_id: selectedStoreId,
        product_gtin: gtin,
        price: parsedPrice,
        in_stock: priceState[gtin]?.inStock ?? true,
        verified: true,
        source: "store_owner",
        verified_by: user?.id,
        updated_by: user?.id,
      },
      { onConflict: "store_id,product_gtin" }
    );

    if (error) toast.error(error.message);
    else {
      toast.success("Price updated & verified");
      await loadStorePrices(selectedStoreId);
    }
  };

  const updateStockStatus = async (gtin: string, stockStatus: boolean) => {
    if (!selectedStoreId) return;

    // A price entry must exist before stock can be toggled.
    if (!priceState[gtin]) {
      toast.error("Set a price for this product first before updating stock status.");
      return;
    }

    setPriceState((p) => ({ ...p, [gtin]: { ...p[gtin], inStock: stockStatus } }));
    const { error } = await supabase
      .from("store_prices")
      .update({ in_stock: stockStatus })
      .eq("store_id", selectedStoreId)
      .eq("product_gtin", gtin);

    if (error) {
      toast.error(error.message);
      setPriceState((p) => ({ ...p, [gtin]: { ...p[gtin], inStock: !stockStatus } }));
    } else {
      toast.success(`Marked as ${stockStatus ? "in stock" : "out of stock"}`);
    }
  };

  const updateStoreContact = async () => {
    if (!selectedStoreId) return;
    setIsSavingContact(true);
    const { error } = await supabase
      .from("stores")
      .update({
        email: storeContact.email.trim() || null,
        contact: storeContact.contact.trim() || null,
        whatsapp: storeContact.whatsapp.trim() || null,
      })
      .eq("id", selectedStoreId);
    setIsSavingContact(false);
    if (error) toast.error(error.message);
    else toast.success("Store contact information updated");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setCsvData((e.target?.result as string) ?? "");
    reader.readAsText(file);
  };

  const downloadSampleCsv = () => {
    const sample =
      "product_gtin,price,in_stock\n1234567890123,9.99,true\n9876543210987,14.50,true\n5551234567890,25.00,false";
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_bulk_prices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Full CSV import pipeline from the original app: header detection, row
  // validation, catalog GTIN check (chunked), dedupe, chunked upsert.
  const importBulkPrices = async () => {
    if (!selectedStoreId || !csvData.trim()) {
      toast.error("Select a store and provide CSV data first");
      return;
    }

    setIsImporting(true);
    setCsvErrors([]);
    setImportStats(null);

    const lines = csvData.trim().split("\n");
    const { data: { user } } = await supabase.auth.getUser();
    const parsedRows: Array<{ line: number; gtin: string; price: number; inStock: boolean }> = [];
    const errors: CsvError[] = [];

    const firstLine = lines[0].trim().toLowerCase();
    const startIndex = firstLine.includes("product_gtin") || firstLine.includes("gtin") ? 1 : 0;

    lines.slice(startIndex).forEach((line, index) => {
      const lineNum = index + startIndex + 1;
      const trimmed = line.trim();
      if (!trimmed) return;

      const [gtin, price, stockStr] = trimmed.split(",").map((s) => s.trim());

      if (!gtin) return void errors.push({ line: lineNum, gtin: "-", message: "Product GTIN is missing" });
      if (!/^\d+$/.test(gtin))
        return void errors.push({ line: lineNum, gtin, message: "Invalid GTIN — must contain only numbers" });
      if (!price) return void errors.push({ line: lineNum, gtin, message: "Price is missing" });

      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice))
        return void errors.push({ line: lineNum, gtin, message: `"${price}" is not a valid price` });
      if (parsedPrice <= 0)
        return void errors.push({ line: lineNum, gtin, message: "Price must be greater than zero" });
      if (parsedPrice > 999999.99)
        return void errors.push({ line: lineNum, gtin, message: "Price is too large (max 999,999.99)" });

      if (stockStr !== undefined && stockStr !== "") {
        if (!["true", "false", "1", "0", "yes", "no"].includes(stockStr.toLowerCase()))
          return void errors.push({
            line: lineNum,
            gtin,
            message: `"${stockStr}" is not a valid stock value — use true/false`,
          });
      }
      const inStockValue =
        stockStr !== undefined && stockStr !== ""
          ? !["false", "0", "no"].includes(stockStr.toLowerCase())
          : true;

      parsedRows.push({ line: lineNum, gtin, price: parsedPrice, inStock: inStockValue });
    });

    if (parsedRows.length === 0) {
      setIsImporting(false);
      setCsvErrors(errors);
      setImportStats({ success: 0, failed: errors.length });
      if (errors.length === 0) toast.error("No valid rows found in the CSV");
      return;
    }

    // Validate GTINs against the catalog in chunks (avoids URL-length limits).
    const uniqueGtins = [...new Set(parsedRows.map((r) => r.gtin))];
    const GTIN_QUERY_CHUNK = 200;
    const validGtins = new Set<string>();
    for (let i = 0; i < uniqueGtins.length; i += GTIN_QUERY_CHUNK) {
      const chunk = uniqueGtins.slice(i, i + GTIN_QUERY_CHUNK);
      const { data: existing, error: fetchError } = await supabase
        .from("products")
        .select("gtin")
        .in("gtin", chunk);
      if (fetchError) {
        setIsImporting(false);
        toast.error(`Failed to validate GTINs: ${fetchError.message}`);
        return;
      }
      (existing || []).forEach((p) => validGtins.add(p.gtin));
    }

    const validRows = parsedRows.filter((row) => {
      if (validGtins.has(row.gtin)) return true;
      errors.push({
        line: row.line,
        gtin: row.gtin,
        message: "Product not found in catalog — this GTIN does not exist in the products database",
      });
      return false;
    });

    // Dedupe by GTIN, keeping the last occurrence.
    const deduped = new Map<string, object>();
    validRows.forEach((row) => {
      deduped.set(row.gtin, {
        store_id: selectedStoreId,
        product_gtin: row.gtin,
        price: row.price,
        in_stock: row.inStock,
        verified: true,
        source: "store_owner",
        verified_by: user?.id,
        updated_by: user?.id,
      });
    });
    const uniqueUpdates = Array.from(deduped.values());
    setCsvErrors(errors);

    if (uniqueUpdates.length === 0) {
      setIsImporting(false);
      setImportStats({ success: 0, failed: errors.length });
      return;
    }

    const UPSERT_CHUNK = 500;
    let importedCount = 0;
    for (let i = 0; i < uniqueUpdates.length; i += UPSERT_CHUNK) {
      const batch = uniqueUpdates.slice(i, i + UPSERT_CHUNK);
      const { error } = await supabase
        .from("store_prices")
        .upsert(batch, { onConflict: "store_id,product_gtin", ignoreDuplicates: false });
      if (error) {
        setIsImporting(false);
        toast.error(
          `${error.message}${importedCount > 0 ? ` (${importedCount} rows imported before failure)` : ""}`
        );
        return;
      }
      importedCount += batch.length;
    }

    setIsImporting(false);
    setImportStats({ success: uniqueUpdates.length, failed: errors.length });
    if (errors.length > 0) {
      toast.warning(`${uniqueUpdates.length} prices imported. ${errors.length} row(s) had errors.`);
    } else {
      toast.success(`${uniqueUpdates.length} prices imported/updated successfully`);
      setCsvData("");
    }
    loadStorePrices(selectedStoreId);
    loadStoreProducts(selectedStoreId);
  };

  const pricedCount = Object.keys(priceState).length;
  const unverifiedCount = Object.values(priceState).filter((p) => !p.verified).length;
  const avgRating =
    feedback.length > 0
      ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length
      : null;

  const storePicker = stores.length > 1 && (
    <select
      className="field w-64"
      value={selectedStoreId}
      onChange={(e) => setSelectedStoreId(e.target.value)}
    >
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {storeName(s)}
        </option>
      ))}
    </select>
  );

  return (
    <Shell
      roleLabel="Store Owner"
      displayName={displayName || undefined}
      nav={nav}
      active={view}
      onNavigate={setView}
      onProfileClick={() => setView("profile")}
    >
      {stores.length === 0 ? (
        <EmptyState
          icon={<Store className="h-10 w-10" />}
          title="No store assigned to your account yet"
          hint="An administrator needs to assign you to a store before you can manage prices."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Your store" value={selectedStore ? storeName(selectedStore) : "—"} />
            <Stat label="Priced products" value={String(pricedCount)} />
            <Stat label="Awaiting verification" value={String(unverifiedCount)} accent={unverifiedCount > 0} />
            <Stat label="Avg. rating" value={avgRating != null ? `${avgRating.toFixed(1)} ★` : "—"} />
          </div>

          {view === "prices" && (
            <Section
              title="Prices & stock"
              subtitle="Search the catalog to price new products, or manage what's already on your shelves. Saving a price marks it verified."
              actions={storePicker}
            >
              <div className="relative mb-4 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  className="field pl-9"
                  placeholder="Search catalog by name or GTIN…"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    debouncedSearch(e.target.value);
                  }}
                />
              </div>

              {products.length === 0 ? (
                <EmptyState
                  icon={<Tags className="h-10 w-10" />}
                  title="Nothing priced yet"
                  hint="Search the catalog above to add prices, or use Bulk Import for a CSV."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                        <th className="py-2 pr-4">Product</th>
                        <th className="py-2 pr-4">Current price</th>
                        <th className="py-2 pr-4">New price</th>
                        <th className="py-2 pr-4">In stock</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => {
                        const state = priceState[product.gtin];
                        return (
                          <tr key={product.gtin} className="border-b border-line/60">
                            <td className="max-w-xs py-3 pr-4">
                              <p className="font-semibold text-ink-heading">{product.description}</p>
                              <p className="text-xs text-ink-faint">GTIN {product.gtin}</p>
                            </td>
                            <td className="py-3 pr-4 font-semibold">
                              {state ? money(currencySymbol, Number(state.price)) : "—"}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex gap-2">
                                <input
                                  className="field h-9 w-28"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder={state?.price ?? "0.00"}
                                  value={priceEdits[product.gtin] ?? ""}
                                  onChange={(e) =>
                                    setPriceEdits((p) => ({ ...p, [product.gtin]: e.target.value }))
                                  }
                                />
                                <button
                                  onClick={() => updatePrice(product.gtin)}
                                  className="btn-primary btn-sm"
                                  disabled={!priceEdits[product.gtin]}
                                >
                                  Save
                                </button>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-brand"
                                checked={state?.inStock ?? false}
                                onChange={(e) => updateStockStatus(product.gtin, e.target.checked)}
                              />
                            </td>
                            <td className="py-3">
                              {state ? (
                                state.verified ? (
                                  <span className="chip bg-brand-tint text-brand-darker">
                                    <BadgeCheck className="h-3 w-3" /> Verified
                                  </span>
                                ) : (
                                  <span className="chip bg-amber-50 text-amber-600">
                                    <Clock className="h-3 w-3" /> Shopper-submitted
                                  </span>
                                )
                              ) : (
                                <span className="text-ink-faint">Unpriced</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {view === "import" && (
            <Section
              title="Bulk price import"
              subtitle="Upload or paste CSV rows: product_gtin, price, in_stock (true/false)."
              actions={storePicker}
            >
              <div className="mb-4 flex flex-wrap gap-3">
                <label className="btn-secondary btn-md cursor-pointer">
                  <Upload className="h-4 w-4" /> Choose CSV file
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
                <button onClick={downloadSampleCsv} className="btn-ghost btn-md">
                  Download sample CSV
                </button>
              </div>
              <textarea
                className="field h-48 resize-y py-2 font-mono text-xs"
                placeholder={"product_gtin,price,in_stock\n6009711320432,89.99,true"}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
              />
              <div className="mt-4 flex items-center gap-3">
                <button onClick={importBulkPrices} disabled={isImporting} className="btn-primary btn-md">
                  {isImporting && <Spinner />}
                  Import prices
                </button>
                {importStats && (
                  <p className="text-sm text-ink-muted">
                    <span className="font-semibold text-brand-darker">{importStats.success} imported</span>
                    {" · "}
                    <span className={importStats.failed > 0 ? "font-semibold text-red-600" : ""}>
                      {importStats.failed} failed
                    </span>
                  </p>
                )}
              </div>
              {csvErrors.length > 0 && (
                <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                  <p className="mb-2 font-bold text-red-700">Rows with errors</p>
                  {csvErrors.map((e, i) => (
                    <p key={i} className="text-red-600">
                      Line {e.line} (GTIN {e.gtin}): {e.message}
                    </p>
                  ))}
                </div>
              )}
            </Section>
          )}

          {view === "contact" && (
            <Section
              title="Store contact details"
              subtitle="Shown to shoppers who want to reach your store."
              actions={storePicker}
            >
              <div className="max-w-md space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Email</label>
                  <input
                    className="field"
                    type="email"
                    value={storeContact.email}
                    onChange={(e) => setStoreContact((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Phone</label>
                  <input
                    className="field"
                    value={storeContact.contact}
                    onChange={(e) => setStoreContact((p) => ({ ...p, contact: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">WhatsApp</label>
                  <input
                    className="field"
                    value={storeContact.whatsapp}
                    onChange={(e) => setStoreContact((p) => ({ ...p, whatsapp: e.target.value }))}
                  />
                </div>
                <button onClick={updateStoreContact} disabled={isSavingContact} className="btn-primary btn-md">
                  {isSavingContact && <Spinner />}
                  Save contact info
                </button>
              </div>
            </Section>
          )}

          {view === "feedback" && (
            <Section
              title="Shopper feedback"
              subtitle="What shoppers are saying about your store."
              actions={storePicker}
            >
              {feedback.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="h-10 w-10" />}
                  title="No feedback yet"
                  hint="Feedback submitted by shoppers will appear here."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {feedback.map((f) => (
                    <div key={f.id} className="card p-4">
                      <div className="flex items-center justify-between">
                        <StarRating value={f.rating} size={16} />
                        <span className="text-xs text-ink-faint">
                          {new Date(f.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        {f.feedback_type}
                      </p>
                      {f.title && <p className="mt-1 font-bold">{f.title}</p>}
                      <p className="mt-1 text-sm text-ink-muted">{f.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {view === "profile" && (
            <Section title="Your profile" subtitle="Country sets your currency across the app.">
              <ProfileEditor
                onSaved={(p) => {
                  setCurrencySymbol(currencySymbolFor(p.currency));
                  setDisplayName(p.display_name ?? "");
                }}
              />
            </Section>
          )}
        </>
      )}

      <Modal
        open={profilePromptOpen}
        onClose={() => setProfilePromptOpen(false)}
        title="Complete your profile"
      >
        <p className="mb-4 text-sm text-ink-muted">
          Set your country so prices display in the right currency, and add contact details.
        </p>
        <ProfileEditor
          onSaved={(p) => {
            setCurrencySymbol(currencySymbolFor(p.currency));
            setDisplayName(p.display_name ?? "");
            setProfilePromptOpen(false);
          }}
        />
      </Modal>
    </Shell>
  );
};

export default StoreOwnerDashboard;
