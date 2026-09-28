import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Modal, Spinner } from "@/components/ui";

interface SuggestionItem {
  gtin: string;
  description: string;
  quantity: number;
  price?: number;
  reason?: string;
}

interface Suggestions {
  currentTotal: string | number;
  suggestedTotal: string | number;
  savings: string | number;
  currentList: SuggestionItem[];
  suggestedList: SuggestionItem[];
}

/**
 * "AI Optimizer" — calls the same suggest-budget-alternatives edge function
 * and applies its suggested list by replacing the current items.
 */
const BudgetAI = ({
  listId,
  budget,
  currencySymbol,
  onApplied,
}: {
  listId: string;
  budget: number;
  currencySymbol: string;
  onApplied: () => Promise<void> | void;
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [open, setOpen] = useState(false);

  const getSuggestions = async () => {
    setLoading(true);
    setSuggestions(null);
    try {
      const { data: items, error: itemsError } = await supabase
        .from("shopping_list_items")
        .select("*, products(description)")
        .eq("shopping_list_id", listId);

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) {
        toast.error("Add items to your list first before getting suggestions.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("suggest-budget-alternatives", {
        body: {
          listItems: items.map((item) => ({
            product: {
              gtin: item.product_gtin,
              description: item.products?.description || "Unknown Product",
            },
            quantity: item.quantity,
          })),
          budget,
          currencySymbol,
        },
      });

      if (error) throw error;
      setSuggestions(data as Suggestions);
      setOpen(true);
    } catch {
      toast.error("Failed to get AI suggestions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const applySuggestions = async () => {
    if (!suggestions) return;
    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from("shopping_list_items")
        .delete()
        .eq("shopping_list_id", listId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from("shopping_list_items").insert(
        suggestions.suggestedList.map((item) => ({
          shopping_list_id: listId,
          product_gtin: item.gtin,
          quantity: item.quantity,
        }))
      );
      if (insertError) throw insertError;

      toast.success(`List updated with AI suggestions. Saved ${currencySymbol}${suggestions.savings}!`);
      setOpen(false);
      await onApplied();
    } catch {
      toast.error("Failed to update list. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={getSuggestions} disabled={loading} className="btn-secondary btn-md">
        {loading ? <Spinner className="h-4 w-4 border-ink/30 border-t-ink" /> : <Sparkles className="h-4 w-4" />}
        AI Optimizer
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="AI budget suggestions" wide>
        {suggestions && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-brand-tint p-4 text-center">
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted">Current</p>
                <p className="text-xl font-bold">
                  {currencySymbol}
                  {suggestions.currentTotal}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted">Suggested</p>
                <p className="text-xl font-bold text-brand-darker">
                  {currencySymbol}
                  {suggestions.suggestedTotal}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted">Savings</p>
                <p className="text-xl font-bold text-brand-darker">
                  -{currencySymbol}
                  {suggestions.savings}
                </p>
              </div>
            </div>
            {Number(suggestions.suggestedTotal) <= budget && (
              <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-darker">
                <Check className="h-4 w-4" />
                Within your budget of {currencySymbol}
                {budget.toFixed(2)}!
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ["Current list", suggestions.currentList],
                  ["Suggested list", suggestions.suggestedList],
                ] as const
              ).map(([label, list]) => (
                <div key={label}>
                  <h4 className="mb-2 font-bold">{label}</h4>
                  <div className="space-y-2">
                    {list.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-line p-3 text-sm">
                        <p className="font-semibold">{item.description}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          Qty {item.quantity}
                          {item.price != null && (
                            <>
                              {" · "}
                              {currencySymbol}
                              {Number(item.price).toFixed(2)}
                            </>
                          )}
                        </p>
                        {item.reason && (
                          <p className="mt-1 text-xs italic text-brand-darker">{item.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-ghost btn-md">
                Keep current list
              </button>
              <button onClick={applySuggestions} disabled={loading} className="btn-primary btn-md">
                {loading && <Spinner />}
                Apply suggestions
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default BudgetAI;
