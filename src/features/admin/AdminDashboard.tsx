import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AppRole, storeName, StoreRow } from "@/lib/helpers";
import Shell from "@/components/Shell";
import { EmptyState, Section, Spinner, Stat } from "@/components/ui";

interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
}

interface StoreWithOwner extends StoreRow {
  profiles?: { user_id: string; display_name: string | null } | null;
}

interface HqRow {
  id: string;
  name: string;
}

interface FoundUser {
  user_id: string;
  email: string | null;
  display_name?: string | null;
}

const ROLES: AppRole[] = ["shopper", "store_owner", "admin", "super_admin"];

const nav = [
  { key: "roles", label: "Users & Roles", icon: <Users className="h-4 w-4" /> },
  { key: "stores", label: "Stores", icon: <Store className="h-4 w-4" /> },
  { key: "assignments", label: "Owner Assignments", icon: <UserCog className="h-4 w-4" /> },
  { key: "products", label: "Product Catalog", icon: <PackagePlus className="h-4 w-4" /> },
];

const AdminDashboard = () => {
  const [view, setView] = useState("roles");
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [stores, setStores] = useState<StoreWithOwner[]>([]);
  const [hqs, setHqs] = useState<HqRow[]>([]);
  const [productCount, setProductCount] = useState<number | null>(null);

  // Roles panel
  const [roleUserId, setRoleUserId] = useState("");
  const [roleToAssign, setRoleToAssign] = useState<AppRole>("shopper");

  // Stores panel
  const [hqName, setHqName] = useState("");
  const [selectedHq, setSelectedHq] = useState("");
  const [location, setLocation] = useState("");
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState("");

  // Assignments panel
  const [emailSearch, setEmailSearch] = useState("");
  const [searchResults, setSearchResults] = useState<FoundUser[]>([]);
  const [assignStoreId, setAssignStoreId] = useState("");
  const [searching, setSearching] = useState(false);

  // Products panel
  const [gtin, setGtin] = useState("");
  const [description, setDescription] = useState("");
  const [bulkData, setBulkData] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const loadUserRoles = useCallback(async () => {
    const { data } = await supabase.from("user_roles").select("id, user_id, role");
    setUserRoles((data as UserRoleRow[]) || []);
  }, []);

  const loadHqs = useCallback(async () => {
    const { data } = await supabase.from("store_hq").select("*");
    setHqs((data as HqRow[]) || []);
  }, []);

  const loadStores = useCallback(async () => {
    const { data, error } = await supabase
      .from("stores")
      .select("*, store_hq(name)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load stores");
      return;
    }
    const rows = (data as StoreWithOwner[]) || [];
    const ownerIds = rows.filter((s) => s.store_owner_id).map((s) => s.store_owner_id!);
    if (ownerIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ownerIds);
      setStores(
        rows.map((store) => ({
          ...store,
          profiles: profilesData?.find((p) => p.user_id === store.store_owner_id) ?? null,
        }))
      );
    } else {
      setStores(rows);
    }
  }, []);

  const loadProductCount = useCallback(async () => {
    const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
    setProductCount(count ?? null);
  }, []);

  useEffect(() => {
    loadUserRoles();
    loadHqs();
    loadStores();
    loadProductCount();
  }, [loadUserRoles, loadHqs, loadStores, loadProductCount]);

  /* ---------- Roles ---------- */

  const assignRole = async () => {
    if (!roleUserId.trim()) {
      toast.error("Enter a user ID");
      return;
    }
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", roleUserId.trim())
      .eq("role", roleToAssign)
      .maybeSingle();
    if (existingRole) {
      toast.error("This user already has this role");
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: roleUserId.trim(), role: roleToAssign });
    if (error) toast.error(error.message);
    else {
      toast.success(`Role "${roleToAssign}" assigned`);
      setRoleUserId("");
      loadUserRoles();
    }
  };

  const deleteRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) toast.error(error.message);
    else {
      toast.success("Role removed");
      loadUserRoles();
    }
  };

  /* ---------- Stores ---------- */

  const createHq = async () => {
    if (!hqName.trim()) {
      toast.error("Enter an HQ name");
      return;
    }
    const { error } = await supabase.from("store_hq").insert({ name: hqName.trim() });
    if (error) toast.error(error.message);
    else {
      toast.success("Store HQ created");
      setHqName("");
      loadHqs();
    }
  };

  const createStore = async () => {
    if (!selectedHq || !location.trim()) {
      toast.error("Select an HQ and enter a location");
      return;
    }
    const { error } = await supabase.from("stores").insert({
      hq_id: selectedHq,
      location: location.trim(),
      store_owner_id: null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Store created");
      setLocation("");
      setSelectedHq("");
      loadStores();
    }
  };

  const updateStoreLocation = async (storeId: string) => {
    if (!editingLocation.trim()) return;
    const { error } = await supabase
      .from("stores")
      .update({ location: editingLocation.trim() })
      .eq("id", storeId);
    if (error) toast.error(error.message);
    else {
      toast.success("Store location updated");
      setEditingStoreId(null);
      setEditingLocation("");
      loadStores();
    }
  };

  const deleteStore = async (storeId: string) => {
    if (!confirm("Delete this store? Its prices will also be removed.")) return;
    const { error } = await supabase.from("stores").delete().eq("id", storeId);
    if (error) toast.error(error.message);
    else {
      toast.success("Store deleted");
      loadStores();
    }
  };

  /* ---------- Assignments ---------- */

  // Search profiles by email; falls back to the search-users edge function
  // (admin-gated) which searches auth users directly.
  const searchUsers = async () => {
    if (!emailSearch.trim()) return;
    setSearching(true);
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, email, display_name")
        .ilike("email", `%${emailSearch}%`);

      let results: FoundUser[] = (profileData as FoundUser[]) || [];

      if (results.length === 0) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("search-users", {
          body: { q: emailSearch },
        });
        if (fnError) {
          toast.error(fnError.message);
          return;
        }
        const users = (fnData as { users?: Array<{ id: string; email: string }> })?.users;
        if (users) {
          results = users.map((u) => ({ user_id: u.id, email: u.email }));
        }
      }

      setSearchResults(results);
      if (results.length === 0) toast.info("No users found for that email");
    } finally {
      setSearching(false);
    }
  };

  const assignUserToStore = async (userId: string) => {
    if (!assignStoreId) {
      toast.error("Select a store first");
      return;
    }
    // Ensure the user has the store_owner role.
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "store_owner")
      .maybeSingle();
    if (!roleData) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "store_owner" });
      if (roleError) {
        toast.error("Failed to assign store_owner role");
        return;
      }
    }

    const { error } = await supabase
      .from("stores")
      .update({ store_owner_id: userId })
      .eq("id", assignStoreId);
    if (error) toast.error(error.message);
    else {
      toast.success("Store owner assigned");
      setEmailSearch("");
      setSearchResults([]);
      setAssignStoreId("");
      loadStores();
      loadUserRoles();
    }
  };

  /* ---------- Products ---------- */

  const addProduct = async () => {
    if (!gtin.trim() || !description.trim()) {
      toast.error("Enter both GTIN and description");
      return;
    }
    const { error } = await supabase
      .from("products")
      .insert({ gtin: gtin.trim(), description: description.trim() });
    if (error) toast.error(error.message);
    else {
      toast.success("Product added to catalog");
      setGtin("");
      setDescription("");
      loadProductCount();
    }
  };

  // Bulk import with duplicate detection (within the CSV and against the DB).
  const importBulkProducts = async () => {
    if (!bulkData.trim()) {
      toast.error("Enter product data first");
      return;
    }
    setIsImporting(true);
    try {
      const lines = bulkData.trim().split("\n");
      const firstLine = lines[0].trim().toLowerCase();
      const startIndex = firstLine.includes("gtin") ? 1 : 0;

      const products: { gtin: string; description: string }[] = [];
      for (const line of lines.slice(startIndex)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const commaIdx = trimmed.indexOf(",");
        if (commaIdx === -1) continue;
        const g = trimmed.slice(0, commaIdx).trim();
        const d = trimmed.slice(commaIdx + 1).trim();
        if (g && d) products.push({ gtin: g, description: d });
      }

      if (products.length === 0) {
        toast.error("No valid rows found (expected: gtin,description)");
        return;
      }

      const gtinCounts = new Map<string, number[]>();
      products.forEach((p, idx) => {
        if (!gtinCounts.has(p.gtin)) gtinCounts.set(p.gtin, []);
        gtinCounts.get(p.gtin)!.push(idx + 1);
      });
      const internalDups = Array.from(gtinCounts.entries())
        .filter(([, rows]) => rows.length > 1)
        .map(([g, rows]) => `GTIN ${g} on rows ${rows.join(", ")}`);
      if (internalDups.length > 0) {
        toast.error(`Duplicates in data: ${internalDups.slice(0, 5).join("; ")}`);
        return;
      }

      const { data: existing } = await supabase
        .from("products")
        .select("gtin")
        .in("gtin", products.map((p) => p.gtin));
      if (existing && existing.length > 0) {
        toast.error(`${existing.length} GTIN(s) already exist in the catalog`);
        return;
      }

      const { error } = await supabase.from("products").insert(products);
      if (error) toast.error(error.message);
      else {
        toast.success(`${products.length} products imported`);
        setBulkData("");
        loadProductCount();
      }
    } finally {
      setIsImporting(false);
    }
  };

  const roleChipClass = (role: AppRole) =>
    role === "super_admin"
      ? "bg-purple-50 text-purple-700"
      : role === "admin"
        ? "bg-blue-50 text-blue-700"
        : role === "store_owner"
          ? "bg-amber-50 text-amber-700"
          : "bg-brand-tint text-brand-darker";

  return (
    <Shell roleLabel="Admin" nav={nav} active={view} onNavigate={setView}>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Role assignments" value={String(userRoles.length)} />
        <Stat label="Stores" value={String(stores.length)} />
        <Stat label="Store HQs" value={String(hqs.length)} />
        <Stat label="Catalog products" value={productCount != null ? String(productCount) : "—"} accent />
      </div>

      {view === "roles" && (
        <div className="space-y-6">
          <Section title="Assign a role" subtitle="Grant a role to a user by their user ID.">
            <div className="flex flex-wrap gap-3">
              <input
                className="field max-w-sm font-mono text-xs"
                placeholder="User ID (uuid)"
                value={roleUserId}
                onChange={(e) => setRoleUserId(e.target.value)}
              />
              <select
                className="field w-40"
                value={roleToAssign}
                onChange={(e) => setRoleToAssign(e.target.value as AppRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button onClick={assignRole} className="btn-primary btn-md">
                <ShieldCheck className="h-4 w-4" /> Assign role
              </button>
            </div>
          </Section>

          <Section title="All role assignments" subtitle="Every user-role pair on the platform.">
            {userRoles.length === 0 ? (
              <EmptyState icon={<Users className="h-10 w-10" />} title="No roles found" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th className="py-2 pr-4">User ID</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {userRoles.map((r) => (
                      <tr key={r.id} className="border-b border-line/60">
                        <td className="py-2.5 pr-4 font-mono text-xs">{r.user_id}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`chip ${roleChipClass(r.role)}`}>{r.role}</span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => deleteRole(r.id)}
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
        </div>
      )}

      {view === "stores" && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Section title="Create store HQ" subtitle="The brand or chain a store belongs to.">
              <div className="flex gap-3">
                <input
                  className="field"
                  placeholder="e.g. FreshMart"
                  value={hqName}
                  onChange={(e) => setHqName(e.target.value)}
                />
                <button onClick={createHq} className="btn-primary btn-md shrink-0">
                  <Building2 className="h-4 w-4" /> Create HQ
                </button>
              </div>
            </Section>
            <Section title="Create store branch" subtitle="A physical location under an HQ.">
              <div className="flex flex-wrap gap-3">
                <select
                  className="field max-w-[180px]"
                  value={selectedHq}
                  onChange={(e) => setSelectedHq(e.target.value)}
                >
                  <option value="">Select HQ…</option>
                  {hqs.map((hq) => (
                    <option key={hq.id} value={hq.id}>
                      {hq.name}
                    </option>
                  ))}
                </select>
                <input
                  className="field max-w-[200px]"
                  placeholder="Location, e.g. Downtown"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <button onClick={createStore} className="btn-primary btn-md">
                  <Plus className="h-4 w-4" /> Create
                </button>
              </div>
            </Section>
          </div>

          <Section title="All stores" subtitle="Edit locations, remove stores, see owners.">
            {stores.length === 0 ? (
              <EmptyState icon={<Store className="h-10 w-10" />} title="No stores yet" />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {stores.map((store) => (
                  <div key={store.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{store.store_hq?.name}</p>
                        {editingStoreId === store.id ? (
                          <div className="mt-1 flex gap-2">
                            <input
                              className="field h-8 text-xs"
                              value={editingLocation}
                              onChange={(e) => setEditingLocation(e.target.value)}
                            />
                            <button
                              onClick={() => updateStoreLocation(store.id)}
                              className="btn-primary btn-sm"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-ink-muted">{store.location}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingStoreId(store.id);
                            setEditingLocation(store.location);
                          }}
                          className="btn-ghost h-8 w-8 rounded-full p-0"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteStore(store.id)}
                          className="btn-ghost h-8 w-8 rounded-full p-0 text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-ink-faint">
                      Owner:{" "}
                      {store.profiles?.display_name ??
                        (store.store_owner_id ? `${store.store_owner_id.slice(0, 8)}…` : "Unassigned")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {view === "assignments" && (
        <Section
          title="Assign store owners"
          subtitle="Find a user by email, pick a store, and assign. The store_owner role is granted automatically."
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                className="field pl-9"
                placeholder="Search user by email…"
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUsers()}
              />
            </div>
            <select
              className="field max-w-xs"
              value={assignStoreId}
              onChange={(e) => setAssignStoreId(e.target.value)}
            >
              <option value="">Assign to store…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {storeName(s)}
                </option>
              ))}
            </select>
            <button onClick={searchUsers} disabled={searching} className="btn-primary btn-md">
              {searching && <Spinner />}
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center justify-between rounded-lg border border-line p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{u.display_name || u.email || u.user_id}</p>
                    <p className="text-xs text-ink-faint">
                      {u.email} · <span className="font-mono">{u.user_id}</span>
                    </p>
                  </div>
                  <button onClick={() => assignUserToStore(u.user_id)} className="btn-primary btn-sm">
                    <UserCog className="h-3.5 w-3.5" /> Assign
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {view === "products" && (
        <div className="space-y-6">
          <Section title="Add a product" subtitle="One product by GTIN and description.">
            <div className="flex flex-wrap gap-3">
              <input
                className="field max-w-[220px]"
                placeholder="GTIN / barcode"
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
              />
              <input
                className="field min-w-[240px] flex-1"
                placeholder="Product description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <button onClick={addProduct} className="btn-primary btn-md">
                <PackagePlus className="h-4 w-4" /> Add product
              </button>
            </div>
          </Section>

          <Section
            title="Bulk import products"
            subtitle="Paste CSV rows: gtin,description. Duplicates (in the data or already in the catalog) are rejected."
          >
            <textarea
              className="field h-48 resize-y py-2 font-mono text-xs"
              placeholder={"gtin,description\n6009711320432,WASHING POWDER POUCH BOOM 4.5KG"}
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
            />
            <button
              onClick={importBulkProducts}
              disabled={isImporting}
              className="btn-primary btn-md mt-4"
            >
              {isImporting && <Spinner />}
              Import products
            </button>
          </Section>
        </div>
      )}
    </Shell>
  );
};

export default AdminDashboard;
