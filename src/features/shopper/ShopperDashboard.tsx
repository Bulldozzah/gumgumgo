import { useCallback, useEffect, useState } from "react";
import {
  ListChecks,
  Search,
  Scale,
  ScanBarcode,
  MessageSquare,
  Store,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  currencySymbolFor,
  ListItemRow,
  money,
  ProfileRow,
  ShoppingListRow,
  StoreRow,
} from "@/lib/helpers";
import Shell from "@/components/Shell";
import { Section, Stat } from "@/components/ui";
import ProfileEditor from "@/components/ProfileEditor";
import ListsPanel from "./ListsPanel";
import ProductsPanel from "./ProductsPanel";
import BrowseStorePanel from "./BrowseStorePanel";
import ComparePanel from "./ComparePanel";
import ScanPanel from "./ScanPanel";
import FeedbackPanel from "./FeedbackPanel";

export interface ListTotals {
  inStock: number;
  all: number;
}

const nav = [
  { key: "lists", label: "My Lists", icon: <ListChecks className="h-4 w-4" /> },
  { key: "products", label: "Find Products", icon: <Search className="h-4 w-4" /> },
  { key: "browse", label: "Browse Store", icon: <Store className="h-4 w-4" /> },
  { key: "compare", label: "Compare Prices", icon: <Scale className="h-4 w-4" /> },
  { key: "scan", label: "Scan a Price", icon: <ScanBarcode className="h-4 w-4" /> },
  { key: "feedback", label: "Store Feedback", icon: <MessageSquare className="h-4 w-4" /> },
  { key: "profile", label: "Profile", icon: <UserRound className="h-4 w-4" /> },
];

const ShopperDashboard = () => {
  const [view, setView] = useState("lists");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingListRow[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [listItems, setListItems] = useState<ListItemRow[]>([]);
  const [listAssignedStores, setListAssignedStores] = useState<Record<string, StoreRow>>({});
  const [listTotals, setListTotals] = useState<Record<string, ListTotals>>({});

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setProfile(data);
      setCurrencySymbol(currencySymbolFor(data.currency));
    }
  }, []);

  const loadStores = useCallback(async () => {
    const { data } = await supabase.from("stores_public").select("*, store_hq(name)");
    setStores((data as StoreRow[]) || []);
  }, []);

  // Loads lists + assigned store info + in-stock/all totals per list.
  const loadShoppingLists = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const lists = (data as ShoppingListRow[]) || [];
    setShoppingLists(lists);

    const storesMap: Record<string, StoreRow> = {};
    const totalsMap: Record<string, ListTotals> = {};

    await Promise.all(
      lists.map(async (list) => {
        if (!list.assigned_store_id) return;
        const { data: storeData } = await supabase
          .from("stores")
          .select("*, store_hq(name)")
          .eq("id", list.assigned_store_id)
          .single();
        if (!storeData) return;
        storesMap[list.id] = storeData as StoreRow;

        const { data: items } = await supabase
          .from("shopping_list_items")
          .select("product_gtin, quantity")
          .eq("shopping_list_id", list.id);
        if (!items || items.length === 0) return;

        const gtins = items.map((i) => i.product_gtin);
        const { data: prices } = await supabase
          .from("store_prices")
          .select("product_gtin, price, in_stock")
          .eq("store_id", list.assigned_store_id)
          .in("product_gtin", gtins);

        let inStock = 0;
        let all = 0;
        for (const item of items) {
          const p = prices?.find((x) => x.product_gtin === item.product_gtin);
          if (!p) continue;
          const line = Number(p.price) * item.quantity;
          all += line;
          if (p.in_stock) inStock += line;
        }
        totalsMap[list.id] = { inStock, all };
      })
    );

    setListAssignedStores(storesMap);
    setListTotals(totalsMap);
  }, []);

  // Loads items for the selected list, enriched with assigned-store prices.
  const loadListItems = useCallback(
    async (listId: string, lists?: ShoppingListRow[]) => {
      const { data } = await supabase
        .from("shopping_list_items")
        .select("*, products(description)")
        .eq("shopping_list_id", listId);

      const items = (data as ListItemRow[]) || [];
      const list = (lists ?? shoppingLists).find((l) => l.id === listId);

      if (list?.assigned_store_id && items.length > 0) {
        const gtins = items.map((i) => i.product_gtin);
        const { data: prices } = await supabase
          .from("store_prices")
          .select("product_gtin, price, in_stock, verified")
          .eq("store_id", list.assigned_store_id)
          .in("product_gtin", gtins);

        setListItems(
          items.map((item) => {
            const p = prices?.find((x) => x.product_gtin === item.product_gtin);
            return {
              ...item,
              price: p?.price,
              in_stock: p?.in_stock ?? false,
              verified: p?.verified ?? false,
            };
          })
        );
      } else {
        setListItems(items);
      }
    },
    [shoppingLists]
  );

  useEffect(() => {
    loadProfile();
    loadStores();
    loadShoppingLists();
  }, [loadProfile, loadStores, loadShoppingLists]);

  useEffect(() => {
    if (selectedListId) loadListItems(selectedListId);
    else setListItems([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId]);

  const refresh = useCallback(async () => {
    await loadShoppingLists();
    if (selectedListId) await loadListItems(selectedListId);
  }, [loadShoppingLists, loadListItems, selectedListId]);

  const selectedList = shoppingLists.find((l) => l.id === selectedListId);
  const selectedTotals = selectedListId ? listTotals[selectedListId] : undefined;

  const shared = {
    currencySymbol,
    stores,
    shoppingLists,
    selectedListId,
    setSelectedListId,
    listItems,
    listAssignedStores,
    listTotals,
    refresh,
  };

  return (
    <Shell
      roleLabel="Shopper"
      displayName={profile?.display_name || undefined}
      nav={nav}
      active={view}
      onNavigate={setView}
      onProfileClick={() => setView("profile")}
    >
      {/* Quick stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Shopping lists" value={String(shoppingLists.length)} />
        <Stat label="Active list" value={selectedList?.name ?? "—"} />
        <Stat
          label="List budget"
          value={selectedList?.budget != null ? money(currencySymbol, Number(selectedList.budget)) : "—"}
        />
        <Stat
          label="In-stock total"
          value={selectedTotals ? money(currencySymbol, selectedTotals.inStock) : "—"}
          accent
        />
      </div>

      {view === "lists" && <ListsPanel {...shared} />}
      {view === "products" && <ProductsPanel {...shared} />}
      {view === "browse" && (
        <BrowseStorePanel
          currencySymbol={currencySymbol}
          shoppingLists={shoppingLists}
          refresh={refresh}
        />
      )}
      {view === "compare" && <ComparePanel {...shared} />}
      {view === "scan" && <ScanPanel currencySymbol={currencySymbol} stores={stores} />}
      {view === "feedback" && <FeedbackPanel stores={stores} />}
      {view === "profile" && (
        <Section title="Your profile" subtitle="Country sets your currency across the app.">
          <ProfileEditor
            onSaved={(p) => {
              setProfile(p);
              setCurrencySymbol(currencySymbolFor(p.currency));
            }}
          />
        </Section>
      )}
    </Shell>
  );
};

export default ShopperDashboard;
