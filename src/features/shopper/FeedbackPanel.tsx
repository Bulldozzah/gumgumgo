import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { storeName, StoreRow } from "@/lib/helpers";
import { Section, Spinner, StarRating } from "@/components/ui";

const FEEDBACK_TYPES = ["Store Service & Experience", "Product Quality & Experience"] as const;

const FeedbackPanel = ({ stores }: { stores: StoreRow[] }) => {
  const [storeId, setStoreId] = useState("");
  const [feedbackType, setFeedbackType] = useState<string>(FEEDBACK_TYPES[0]);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!storeId) {
      toast.error("Please select a store");
      return;
    }
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    if (!body.trim()) {
      toast.error("Please provide feedback");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to submit feedback");
        return;
      }

      const { error } = await supabase.from("store_feedback").insert({
        user_id: user.id,
        store_id: storeId,
        rating,
        feedback_type: feedbackType,
        title: title.trim() || null,
        body: body.trim(),
      });
      if (error) throw error;

      toast.success("Feedback submitted — thank you!");
      setStoreId("");
      setRating(0);
      setTitle("");
      setBody("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Section
      title="Rate a store"
      subtitle="Your feedback helps other shoppers and keeps stores honest."
    >
      <div className="max-w-xl space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Store</label>
          <select className="field" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Select store…</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {storeName(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Feedback type</label>
          <select
            className="field"
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value)}
          >
            {FEEDBACK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Rating</label>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Title (optional)</label>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum it up in a few words"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Your feedback</label>
          <textarea
            className="field h-28 resize-none py-2"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tell us about your experience…"
          />
        </div>
        <button onClick={submit} disabled={isSubmitting} className="btn-primary btn-md">
          {isSubmitting ? <Spinner /> : <MessageSquare className="h-4 w-4" />}
          Submit feedback
        </button>
      </div>
    </Section>
  );
};

export default FeedbackPanel;
