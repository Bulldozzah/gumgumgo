import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { countries } from "@/lib/countries";
import { ProfileRow } from "@/lib/helpers";
import { Spinner } from "@/components/ui";

const emptyProfile = {
  display_name: "",
  email: "",
  country: "",
  currency: "",
  phone: "",
  phone_area_code: "",
  whatsapp: "",
  contact: "",
};

const ProfileEditor = ({ onSaved }: { onSaved?: (profile: ProfileRow) => void }) => {
  const [profile, setProfile] = useState({ ...emptyProfile });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfile({
          display_name: data.display_name ?? "",
          email: data.email ?? user.email ?? "",
          country: data.country ?? "",
          currency: data.currency ?? "",
          phone: data.phone ?? "",
          phone_area_code: data.phone_area_code ?? "",
          whatsapp: data.whatsapp ?? "",
          contact: data.contact ?? "",
        });
      } else {
        setProfile((p) => ({ ...p, email: user.email ?? "" }));
      }
    })();
  }, []);

  // Selecting a country auto-fills currency and phone code, as in the original.
  const handleCountryChange = (countryName: string) => {
    const country = countries.find((c) => c.name === countryName);
    setProfile((p) => ({
      ...p,
      country: countryName,
      currency: country?.currencyCode ?? p.currency,
      phone_area_code: country?.phoneCode ?? p.phone_area_code,
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const payload = {
      user_id: user.id,
      display_name: profile.display_name,
      phone: profile.phone,
      phone_area_code: profile.phone_area_code,
      country: profile.country,
      currency: profile.currency,
      email: profile.email,
      whatsapp: profile.whatsapp,
      contact: profile.contact,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" });

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile saved");
      onSaved?.(payload as unknown as ProfileRow);
    }
  };

  const set = (key: keyof typeof emptyProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile((p) => ({ ...p, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Display name</label>
          <input className="field" value={profile.display_name} onChange={set("display_name")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Email</label>
          <input className="field" type="email" value={profile.email} onChange={set("email")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Country</label>
          <select
            className="field"
            value={profile.country}
            onChange={(e) => handleCountryChange(e.target.value)}
          >
            <option value="">Select country…</option>
            {countries.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.currencySymbol})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Currency</label>
          <input className="field bg-gray-50" value={profile.currency} readOnly />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Phone</label>
          <div className="flex gap-2">
            <input className="field w-24" value={profile.phone_area_code} readOnly />
            <input className="field" value={profile.phone} onChange={set("phone")} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">WhatsApp</label>
          <input className="field" value={profile.whatsapp} onChange={set("whatsapp")} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold">Other contact</label>
          <input className="field" value={profile.contact} onChange={set("contact")} />
        </div>
      </div>
      <button onClick={handleSave} disabled={loading} className="btn-primary btn-md">
        {loading && <Spinner />}
        Save profile
      </button>
    </div>
  );
};

export default ProfileEditor;
