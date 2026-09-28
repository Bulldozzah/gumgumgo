import { useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  ListChecks,
  MapPin,
  Minus,
  Plus,
  Share2,
  Store,
  Trash2,
  Unlink,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ListItemRow,
  money,
  openStoreMap,
  ShoppingListRow,
  storeName,
  StoreRow,
} from "@/lib/helpers";
import { shareTextOrCopy } from "@/lib/share";
import { EmptyState, Modal, Section } from "@/components/ui";
import { ListTotals } from "./ShopperDashboard";
import BudgetAI from "./BudgetAI";

interface Props {
  currencySymbol: string;
  stores: StoreRow[];
  shoppingLists: ShoppingListRow[];
  selectedListId: string;
  setSelectedListId: (id: string) => void;
  listItems: ListItemRow[];
  listAssignedStores: Record<string, StoreRow>;
  listTotals: Record<string, ListTotals>;
  refresh: () => Promise<void>;
}

const ListsPanel = ({
  currencySymbol,
  stores,
  shoppingLists,
  selectedListId,
  setSelectedListId,
  listItems,
  listAssignedStores,
  listTotals,
  refresh,
}: Props) => {
  const [newListName, setNewListName] = useState("");
  const [newListBudget, setNewListBudget] = useState("");
  const [assignDialogList, setAssignDialogList] = useState<ShoppingListRow | null>(null);
  const [confirmDeleteList, setConfirmDeleteList] = useState<ShoppingListRow | null>(null);
  const [storeSearch, setStoreSearch] = useState("");
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({});

  const createNewList = async () => {
    if (!newListName.trim()) {
      toast.error("Please enter a list name");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({
        name: newListName,
        user_id: user.id,
        budget: newListBudget ? parseFloat(newListBudget) : null,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("List created");
      setNewListName("");
      setNewListBudget("");
      setSelectedListId(data.id);
      await refresh();
    }
  };

  const updateBudget = async (listId: string) => {
    const value = budgetEdits[listId];
    const { error } = await supabase
      .from("shopping_lists")
      .update({ budget: value ? parseFloat(value) : null })
      .eq("id", listId);
    if (error) toast.error(error.message);
    else {
      toast.success("Budget updated");
      setBudgetEdits((p) => ({ ...p, [listId]: "" }));
      await refresh();
    }
  };

  const deleteList = async (listId: string) => {
    const { error } = await supabase.from("shopping_lists").delete().eq("id", listId);
    if (error) toast.error(error.message);
    else {
      toast.success("List deleted");
      if (selectedListId === listId) setSelectedListId("");
      await refresh();
    }
  };

  const assignStore = async (listId: string, store: StoreRow) => {
    const { error } = await supabase
      .from("shopping_lists")
      .update({ assigned_store_id: store.id })
      .eq("id", listId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Assigned to ${storeName(store)}`);
      setAssignDialogList(null);
      await refresh();
    }
  };

  const unassignStore = async (listId: string) => {
    const { error } = await supabase
      .from("shopping_lists")
      .update({ assigned_store_id: null })
      .eq("id", listId);
    if (error) toast.error(error.message);
    else {
      toast.success("Store unassigned");
      await refresh();
    }
  };

  // Builds the same share text as the WiseUp Android app: list name, store
  // details, numbered items with qty/price/stock marks, and the in-stock total.
  const shareList = async (list: ShoppingListRow, assigned?: StoreRow) => {
    const { data } = await supabase
      .from("shopping_list_items")
      .select("*, products(description)")
      .eq("shopping_list_id", list.id);
    const items = (data as ListItemRow[]) || [];

    const priceMap: Record<string, { price: number; in_stock: boolean }> = {};
    if (assigned && items.length > 0) {
      const { data: prices } = await supabase
        .from("store_prices")
        .select("product_gtin, price, in_stock")
        .eq("store_id", assigned.id)
        .in("product_gtin", items.map((i) => i.product_gtin));
      for (const p of prices ?? []) priceMap[p.product_gtin] = p;
    }

    let inStockTotal = 0;
    const lines = items.map((item, idx) => {
      const p = priceMap[item.product_gtin];
      if (p?.in_stock) inStockTotal += Number(p.price) * item.quantity;
      let line = `${idx + 1}. ${item.products?.description ?? item.product_gtin} x${item.quantity}`;
      if (p) line += ` @ ${money(currencySymbol, Number(p.price))}${p.in_stock ? " ✓" : " ✗"}`;
      return line;
    });

    const header = [`*${list.name}*`];
    if (assigned) {
      header.push(`Store: ${storeName(assigned)}`);
      if (assigned.address) header.push(`Address: ${assigned.address}`);
      if (
        assigned.city &&
        !(assigned.address ?? "").toLowerCase().includes(assigned.city.toLowerCase())
      ) {
        header.push(`City: ${assigned.city}`);
      }
    } else {
      header.push("Store: Unassigned");
    }

    const text = [
      ...header,
      "",
      ...lines,
      "",
      `Total (in-stock): ${money(currencySymbol, inStockTotal)}`,
    ].join("\n");

    const outcome = await shareTextOrCopy(list.name, text);
    if (outcome === "copied") toast.success("Sharing unavailable — list copied to clipboard");
    else if (outcome === "failed") toast.error("Could not share the list");
  };

  const updateItemQuantity = async (item: ListItemRow, delta: number) => {
    const newQuantity = Math.max(1, item.quantity + delta);
    const { error } = await supabase
      .from("shopping_list_items")
      .update({ quantity: newQuantity })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else await refresh();
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId);
    if (error) toast.error(error.message);
    else await refresh();
  };

  const filteredStores = stores.filter((s) =>
    storeName(s).toLowerCase().includes(storeSearch.toLowerCase())
  );

  const selectedList = shoppingLists.find((l) => l.id === selectedListId);
  const selectedTotals = selectedListId ? listTotals[selectedListId] : undefined;
  const overBudget =
    selectedList?.budget != null &&
    selectedTotals != null &&
    selectedTotals.inStock > Number(selectedList.budget);

  return (
    <div className="space-y-6">
      <Section title="Create a list" subtitle="Give it a name and an optional budget.">
        <div className="flex flex-wrap gap-3">
          <input
            className="field max-w-xs"
            placeholder="e.g. Weekly groceries"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
          />
          <input
            className="field max-w-[160px]"
            type="number"
            min="0"
            step="0.01"
            placeholder={`Budget (${currencySymbol})`}
            value={newListBudget}
            onChange={(e) => setNewListBudget(e.target.value)}
          />
          <button onClick={createNewList} className="btn-primary btn-md">
            <Plus className="h-4 w-4" /> Create list
          </button>
        </div>
      </Section>

      <Section title="My shopping lists" subtitle="Select a list to manage its items.">
        {shoppingLists.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-10 w-10" />}
            title="No lists yet"
            hint="Create your first list above, then add products from the Find Products tab."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {shoppingLists.map((list) => {
              const totals = listTotals[list.id];
              const assigned = listAssignedStores[list.id];
              const isSelected = list.id === selectedListId;
              return (
                <div
                  key={list.id}
                  className={`card-hover cursor-pointer p-4 ${
                    isSelected ? "border-brand ring-1 ring-brand" : ""
                  }`}
                  onClick={() => setSelectedListId(list.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{list.name}</p>
                      <p className="text-xs text-ink-faint">
                        {new Date(list.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="chip bg-brand-tint text-brand-darker">Active</span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <p className="flex items-center gap-1.5 text-ink-muted">
                      <Store className="h-3.5 w-3.5" />
                      {assigned ? storeName(assigned) : "No store assigned"}
                      {assigned && (
                        <button
                          className="text-red-500 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            unassignStore(list.id);
                          }}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </p>
                    {assigned?.address && (
                      <p className="pl-5 text-xs text-ink-faint">{assigned.address}</p>
                    )}
                    {assigned?.city &&
                      !(assigned.address ?? "")
                        .toLowerCase()
                        .includes(assigned.city.toLowerCase()) && (
                        <p className="pl-5 text-xs text-ink-faint">{assigned.city}</p>
                      )}
                    <p className="text-ink-muted">
                      Budget:{" "}
                      <span className="font-semibold text-ink-heading">
                        {list.budget != null ? money(currencySymbol, Number(list.budget)) : "—"}
                      </span>
                      {totals && (
                        <>
                          {" · "}In stock:{" "}
                          <span className="font-semibold text-brand-darker">
                            {money(currencySymbol, totals.inStock)}
                          </span>
                          {" · "}All:{" "}
                          <span className="font-semibold">{money(currencySymbol, totals.all)}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div
                    className="mt-3 flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      className="field h-8 w-28 text-xs"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="New budget"
                      value={budgetEdits[list.id] ?? ""}
                      onChange={(e) =>
                        setBudgetEdits((p) => ({ ...p, [list.id]: e.target.value }))
                      }
                    />
                    <button onClick={() => updateBudget(list.id)} className="btn-secondary btn-sm">
                      Set budget
                    </button>
                    <button
                      onClick={() => setAssignDialogList(list)}
                      className="btn-secondary btn-sm"
                    >
                      <Store className="h-3.5 w-3.5" /> Assign store
                    </button>
                    {assigned && (
                      <button
                        onClick={() => openStoreMap(assigned)}
                        className="btn-secondary btn-sm"
                        title="Open store location in a map app"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Map
                      </button>
                    )}
                    <button
                      onClick={() => shareList(list, assigned)}
                      className="btn-secondary btn-sm"
                      title="Share this list"
                    >
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                    <button
                      onClick={() => setConfirmDeleteList(list)}
                      className="btn-danger btn-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {selectedList && (
        <Section
          title={`Items in "${selectedList.name}"`}
          subtitle={
            listAssignedStores[selectedList.id]
              ? `Prices from ${storeName(listAssignedStores[selectedList.id])}`
              : "Assign a store to see prices for these items."
          }
          actions={
            selectedList.budget != null && (
              <BudgetAI
                listId={selectedList.id}
                budget={Number(selectedList.budget)}
                currencySymbol={currencySymbol}
                onApplied={refresh}
              />
            )
          }
        >
          {overBudget && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              This list is over budget — in-stock total{" "}
              {money(currencySymbol, selectedTotals!.inStock)} exceeds{" "}
              {money(currencySymbol, Number(selectedList.budget))}. Try the AI suggestions.
            </div>
          )}
          {listItems.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-10 w-10" />}
              title="This list is empty"
              hint="Head to Find Products to add items."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-4">Product</th>
                    <th className="py-2 pr-4">Qty</th>
                    <th className="py-2 pr-4">Price</th>
                    <th className="py-2 pr-4">Line total</th>
                    <th className="py-2 pr-4">Stock</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {listItems.map((item) => (
                    <tr key={item.id} className="border-b border-line/60">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-ink-heading">
                          {item.products?.description ?? item.product_gtin}
                        </p>
                        <p className="text-xs text-ink-faint">GTIN {item.product_gtin}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateItemQuantity(item, -1)}
                            className="btn-ghost h-7 w-7 rounded-full p-0"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateItemQuantity(item, 1)}
                            className="btn-ghost h-7 w-7 rounded-full p-0"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {item.price != null ? (
                          <span className="inline-flex items-center gap-1 font-semibold">
                            {money(currencySymbol, Number(item.price))}
                            {item.verified && (
                              <BadgeCheck className="h-4 w-4 text-brand" aria-label="Verified price" />
                            )}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-semibold">
                        {item.price != null
                          ? money(currencySymbol, Number(item.price) * item.quantity)
                          : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        {item.price == null ? (
                          <span className="text-ink-faint">n/a</span>
                        ) : item.in_stock ? (
                          <span className="chip bg-brand-tint text-brand-darker">
                            <CheckCircle2 className="h-3 w-3" /> In stock
                          </span>
                        ) : (
                          <span className="chip bg-red-50 text-red-600">
                            <XCircle className="h-3 w-3" /> Out
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="btn-ghost h-8 w-8 rounded-full p-0 text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      <Modal
        open={assignDialogList !== null}
        onClose={() => setAssignDialogList(null)}
        title={`Assign a store to "${assignDialogList?.name ?? ""}"`}
      >
        <input
          className="field mb-3"
          placeholder="Search stores…"
          value={storeSearch}
          onChange={(e) => setStoreSearch(e.target.value)}
        />
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {filteredStores.map((store) => (
            <button
              key={store.id}
              onClick={() => assignDialogList && assignStore(assignDialogList.id, store)}
              className="flex w-full items-center gap-2 rounded-lg border border-line p-3 text-left text-sm font-semibold hover:border-brand hover:bg-brand-tint"
            >
              <Store className="h-4 w-4 text-brand" />
              {storeName(store)}
            </button>
          ))}
          {filteredStores.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-muted">No stores match.</p>
          )}
        </div>
      </Modal>

      <Modal
        open={confirmDeleteList !== null}
        onClose={() => setConfirmDeleteList(null)}
        title="Delete list?"
      >
        <p className="text-sm text-ink-muted">
          This will permanently delete "{confirmDeleteList?.name}" and all its items.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary btn-md" onClick={() => setConfirmDeleteList(null)}>
            Cancel
          </button>
          <button
            className="btn-danger btn-md"
            onClick={async () => {
              if (confirmDeleteList) {
                await deleteList(confirmDeleteList.id);
                setConfirmDeleteList(null);
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ListsPanel;
