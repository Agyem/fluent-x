// Shipping configuration — isolated, authoritative for storefront
// Existing DB has `settings.delivery_fee = 15` (single value, not per method) — not per-method, so we use code config per task spec
// Example from spec: Air GH₵150, Sea GH₵50 — isolated here so DB can later provide config without rewriting checkout
// Do NOT hardcode elsewhere — import from here

export type ShippingMethod = 'free'

export const SHIPPING_OPTIONS = {
  free: {
    id: 'free' as const,
    label: 'Free Delivery',
    type: 'Standard',
    estimate: '3–7 days',
    fee: 0,
    expectedDays: { min: 3, max: 7 },
  },
} as const

export function getShippingFee(_method: ShippingMethod): number {
  return 0
}

export function getExpectedDeliveryDate(_method: ShippingMethod): string {
  const days = 5
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function formatShippingLabel(_method: ShippingMethod): string {
  return 'Free Delivery · Standard · 3–7 days'
}
