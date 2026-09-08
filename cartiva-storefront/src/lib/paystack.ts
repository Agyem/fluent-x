// Paystack client configuration — public (publishable) key only.
// The SECRET key (sk_...) must NEVER appear here or in any VITE_ variable.
// It lives only in Supabase Edge Functions secrets as PAYSTACK_SECRET_KEY
// (used by supabase/functions/paystack-init and paystack-verify).

export const PAYSTACK_PUBLIC_KEY =
  (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined) ?? ''

export const isPaystackConfigured = () => PAYSTACK_PUBLIC_KEY.length > 0
