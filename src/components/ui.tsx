import { ReactNode } from "react";
import { X, Star } from "lucide-react";

export const Logo = ({ className = "text-2xl" }: { className?: string }) => (
  <span className={`font-extrabold tracking-tight text-ink-heading ${className}`}>
    gumgumgo<span className="text-brand">.</span>
  </span>
);

export const Section = ({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section className="card p-5 md:p-6">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
    {children}
  </section>
);

export const Modal = ({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[85vh] w-full ${wide ? "max-w-3xl" : "max-w-lg"} overflow-y-auto rounded-xl bg-white p-6 shadow-pop`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="btn-ghost h-8 w-8 rounded-full p-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const EmptyState = ({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line py-12 text-center">
    <div className="mb-3 text-ink-faint">{icon}</div>
    <p className="font-semibold text-ink-heading">{title}</p>
    {hint && <p className="mt-1 max-w-sm text-sm text-ink-muted">{hint}</p>}
  </div>
);

export const StarRating = ({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(n)}
        className={onChange ? "transition-transform hover:scale-110" : "cursor-default"}
      >
        <Star
          style={{ width: size, height: size }}
          className={n <= value ? "fill-star text-star" : "text-line"}
        />
      </button>
    ))}
  </div>
);

export const Spinner = ({ className = "h-4 w-4" }: { className?: string }) => (
  <span className={`inline-block animate-spin rounded-full border-2 border-white/40 border-t-white ${className}`} />
);

export const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="card p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
    <p className={`mt-1 text-xl font-bold ${accent ? "text-brand" : "text-ink-heading"}`}>{value}</p>
  </div>
);
