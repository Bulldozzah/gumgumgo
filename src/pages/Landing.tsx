import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Scale,
  ListChecks,
  ScanBarcode,
  Sparkles,
  MapPin,
  Store,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Logo } from "@/components/ui";

const features = [
  {
    icon: <Scale className="h-6 w-6" />,
    title: "Compare store prices",
    text: "See what your whole list costs at up to two stores side by side — before you leave home.",
  },
  {
    icon: <ListChecks className="h-6 w-6" />,
    title: "Smart shopping lists",
    text: "Build lists with budgets, assign them to a store and watch live in-stock totals.",
  },
  {
    icon: <MapPin className="h-6 w-6" />,
    title: "Auto-check nearby",
    text: "One tap compares your list at the 5 closest stores using your location.",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "AI budget rescue",
    text: "Over budget? AI suggests cheaper alternatives that keep your basket complete.",
  },
  {
    icon: <ScanBarcode className="h-6 w-6" />,
    title: "Scan & submit prices",
    text: "Scan a barcode in-store, check the price, and submit updates for the community.",
  },
  {
    icon: <Store className="h-6 w-6" />,
    title: "Store owner tools",
    text: "Owners keep prices fresh with bulk CSV imports, stock flags and verified badges.",
  },
];

const steps = [
  { n: "1", title: "Create your list", text: "Add products by search or barcode and set a budget." },
  { n: "2", title: "Compare stores", text: "gumgumgo totals your list at each store, flagging out-of-stock items." },
  { n: "3", title: "Shop & save", text: "Pick the winning store, follow your list, stay on budget." },
];

const Landing = () => (
  <div className="min-h-screen bg-white">
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link to="/auth" className="btn-ghost btn-md">
            Sign in
          </Link>
          <Link to="/auth?join=1" className="btn-primary btn-md">
            Join
          </Link>
        </nav>
      </div>
    </header>

    {/* Hero — Fiverr-style deep charcoal panel with bold serif-weight headline */}
    <section className="bg-[#013912]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-extrabold leading-tight text-white md:text-5xl">
            Groceries cost less when{" "}
            <span className="text-brand">you know the price.</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-white/80">
            Compare your entire shopping list across local stores, get AI help
            when the budget is tight, and never overpay again.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/auth?join=1" className="btn-primary btn-lg">
              <ShoppingCart className="h-5 w-5" />
              Start saving — it's free
            </Link>
            <div className="flex items-center gap-1.5 text-sm text-white/70">
              <Star className="h-4 w-4 fill-star text-star" />
              Trusted by shoppers, stores & admins
            </div>
          </div>
        </div>
        <div className="hidden items-center justify-center md:flex">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-pop">
            <p className="text-sm font-bold text-ink-heading">Weekly Basket · 12 items</p>
            <div className="mt-4 space-y-3">
              {[
                { store: "FreshMart — Downtown", total: "K 842.50", best: true },
                { store: "SuperSave — Northgate", total: "K 897.20", best: false },
                { store: "ValueGrocer — East End", total: "K 921.75", best: false },
              ].map((r) => (
                <div
                  key={r.store}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    r.best ? "border-brand bg-brand-tint" : "border-line"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-heading">{r.store}</p>
                    {r.best && (
                      <p className="flex items-center gap-1 text-xs font-semibold text-brand-darker">
                        <ShieldCheck className="h-3.5 w-3.5" /> Best total price
                      </p>
                    )}
                  </div>
                  <p className={`text-sm font-bold ${r.best ? "text-brand-darker" : "text-ink"}`}>
                    {r.total}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <h2 className="text-2xl font-bold md:text-3xl">Everything you need to shop smarter</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card-hover p-5">
            <div className="mb-3 inline-flex rounded-lg bg-brand-tint p-2.5 text-brand-darker">
              {f.icon}
            </div>
            <h3 className="font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-ink-muted">{f.text}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="border-y border-line bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <h2 className="text-2xl font-bold md:text-3xl">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
                {s.n}
              </div>
              <div>
                <h3 className="font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-16 text-center md:px-6">
      <h2 className="text-2xl font-bold md:text-3xl">Ready to stop overpaying?</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-muted">
        Join gumgumgo free and see what your next shop really costs.
      </p>
      <Link to="/auth?join=1" className="btn-primary btn-lg mt-6">
        Create your free account
      </Link>
    </section>

    <footer className="border-t border-line py-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 md:px-6">
        <Logo className="text-lg" />
        <p className="text-sm text-ink-faint">
          © {new Date().getFullYear()} gumgumgo. Shop smart, save more.
        </p>
      </div>
    </footer>
  </div>
);

export default Landing;
