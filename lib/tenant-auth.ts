import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyLoginIdentifier,
  normalizeIndianMobile,
} from "@/lib/login-identifier";

const LOGIN_EMAIL_DOMAIN = "tenant-auth.invalid";

/** Internal Auth email — tenant signs in with mobile, not this address. */
export function tenantLoginEmailFromMobile(mobile: string): string {
  return `${mobile}@${LOGIN_EMAIL_DOMAIN}`;
}

function authPhoneE164(mobile: string): string {
  return `+91${mobile}`;
}

export type CreateTenantLoginResult =
  | { ok: true; userId: string; loginEmail: string }
  | { ok: false; error: string };

export async function createTenantPortalLogin(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    mobile: string;
    password: string;
    email?: string | null;
    fullName?: string | null;
  }
): Promise<CreateTenantLoginResult> {
  const tenantId = input.tenantId.trim();
  if (!tenantId) return { ok: false, error: "Missing tenant." };

  const mobile = normalizeIndianMobile(input.mobile);
  if (!mobile) {
    return { ok: false, error: "Enter a valid 10-digit mobile number." };
  }

  const password = input.password;
  if (!password || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const optionalEmail = input.email?.trim().toLowerCase() || null;
  if (optionalEmail && !optionalEmail.includes("@")) {
    return { ok: false, error: "Enter a valid email or leave it blank." };
  }

  const loginEmail = optionalEmail ?? tenantLoginEmailFromMobile(mobile);

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id,full_name,email,phone,profile_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    return { ok: false, error: tenantError?.message ?? "Tenant not found." };
  }

  if (tenant.profile_id) {
    return {
      ok: false,
      error: "This tenant already has a portal login. Use reset password instead.",
    };
  }

  const { data: phoneConflict } = await admin
    .from("tenants")
    .select("id")
    .neq("id", tenantId)
    .not("profile_id", "is", null)
    .ilike("phone", `%${mobile}%`)
    .limit(1);

  if (phoneConflict && phoneConflict.length > 0) {
    return {
      ok: false,
      error: "Another tenant is already linked to this mobile number.",
    };
  }

  const fullName =
    input.fullName?.trim() || tenant.full_name?.trim() || "Tenant";

  let created = await admin.auth.admin.createUser({
    email: loginEmail,
    phone: authPhoneE164(mobile),
    password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { full_name: fullName },
  });

  // Phone provider may be off in Supabase — mobile login still works via
  // tenants.phone → resolve_login_email → password sign-in.
  if (created.error && /phone|sms|provider/i.test(created.error.message)) {
    created = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
  }

  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? "Could not create login.";
    if (/already registered|already exists|duplicate/i.test(msg)) {
      return {
        ok: false,
        error:
          "This mobile or email is already registered in Auth. Link manually or use a different number.",
      };
    }
    return { ok: false, error: msg };
  }

  const userId = created.data.user.id;

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      role: "tenant",
      is_active: true,
      full_name: fullName,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error: profileError.message ?? "Could not create tenant profile.",
    };
  }

  const tenantUpdate: Record<string, string> = {
    phone: mobile,
  };
  if (optionalEmail) tenantUpdate.email = optionalEmail;

  const { error: linkError } = await admin
    .from("tenants")
    .update({
      profile_id: userId,
      ...tenantUpdate,
    })
    .eq("id", tenantId);

  if (linkError) {
    await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error: linkError.message ?? "Could not link tenant to login.",
    };
  }

  return { ok: true, userId, loginEmail };
}

export async function resetTenantPortalPassword(
  admin: SupabaseClient,
  input: { tenantId: string; password: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantId = input.tenantId.trim();
  const password = input.password;

  if (!tenantId) return { ok: false, error: "Missing tenant." };
  if (!password || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("profile_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !tenant?.profile_id) {
    return {
      ok: false,
      error: "No portal login exists for this tenant yet.",
    };
  }

  const { error } = await admin.auth.admin.updateUserById(tenant.profile_id, {
    password,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Validate mobile for display before create (reuse login classifier). */
export function parseTenantLoginMobile(raw: string): string | null {
  const classified = classifyLoginIdentifier(raw);
  if (classified.kind === "mobile" && classified.mobile) return classified.mobile;
  return normalizeIndianMobile(raw);
}
