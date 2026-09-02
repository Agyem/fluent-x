// Manual Mobile Money configuration — placeholder until admin provides real values
// Do NOT hardcode fake MoMo number — this is a config placeholder

export const MOMO_CONFIG = {
  // TODO: Configure with real Cartiva MoMo details (required before production)
  network: import.meta.env.VITE_MOMO_NETWORK as string | undefined ?? undefined, // e.g. "MTN", "Vodafone", "AirtelTigo"
  accountName: import.meta.env.VITE_MOMO_ACCOUNT_NAME as string | undefined ?? undefined, // e.g. "Cartiva Ltd"
  accountNumber: import.meta.env.VITE_MOMO_NUMBER as string | undefined ?? undefined, // e.g. "024XXXXXXX"
}

// Helper to check if MoMo is configured
export const isMomoConfigured = () => !!(MOMO_CONFIG.network && MOMO_CONFIG.accountName && MOMO_CONFIG.accountNumber)
