import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadJointUpiDefaults,
  type PaymentAccountUpiDefaults,
} from "@/lib/payment-accounts";

/** Joint-account UPI/QR for tenant and public pay when a flat has none. */
export async function loadPayUpiFallback(): Promise<PaymentAccountUpiDefaults> {
  const admin = createAdminClient();
  if (!admin.ok) {
    return { upiId: null, upiQrUrl: null, accountId: null };
  }
  return loadJointUpiDefaults(admin.client);
}
