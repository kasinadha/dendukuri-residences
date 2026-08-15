import type { SupabaseClient } from "@supabase/supabase-js";

/** Canonical property name for Dendukuri's Residences. */
export const PROPERTY_NAME = "Dendukuri's Residences";

export type PropertyRecord = {
  id: string | null;
  name: string;
  /** `properties` table when migration applied; otherwise flats.building only. */
  mode: "properties" | "building";
};

function isMissingRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table/i.test(error.message ?? "") ||
    /relation .* does not exist/i.test(error.message ?? "")
  );
}

/**
 * Ensures the single property row for Dendukuri's Residences exists.
 * Does not create flats or tenants.
 */
export async function ensureDendukuriProperty(
  supabase: SupabaseClient
): Promise<PropertyRecord> {
  const { data: existing, error } = await supabase
    .from("properties")
    .select("id,name")
    .eq("name", PROPERTY_NAME)
    .maybeSingle();

  if (isMissingRelation(error)) {
    return { id: null, name: PROPERTY_NAME, mode: "building" };
  }

  if (existing?.id) {
    return { id: existing.id, name: existing.name, mode: "properties" };
  }

  const { data: created, error: insertError } = await supabase
    .from("properties")
    .insert({ name: PROPERTY_NAME })
    .select("id,name")
    .single();

  if (insertError || !created) {
    // Table may exist but RLS blocked; still expose the canonical name in UI.
    if (isMissingRelation(insertError)) {
      return { id: null, name: PROPERTY_NAME, mode: "building" };
    }
    return { id: null, name: PROPERTY_NAME, mode: "building" };
  }

  return { id: created.id, name: created.name, mode: "properties" };
}

export async function getDendukuriProperty(
  supabase: SupabaseClient
): Promise<PropertyRecord> {
  const { data, error } = await supabase
    .from("properties")
    .select("id,name")
    .eq("name", PROPERTY_NAME)
    .maybeSingle();

  if (isMissingRelation(error) || !data) {
    return { id: null, name: PROPERTY_NAME, mode: "building" };
  }

  return { id: data.id, name: data.name, mode: "properties" };
}
