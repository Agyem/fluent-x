// Shipping configuration — isolated, authoritative for storefront
// Existing DB has `settings.delivery_fee = 15` (single value, not per method) — not per-method, so we use code config per task spec
// Example from spec: Air GH₵150, Sea GH₵50 — isolated here so DB can later provide config without rewriting checkout
// Do NOT hardcode elsewhere — import from here

export type ShippingMethod = 'air' | 'sea'

export const SHIPPING_OPTIONS = {
  air: {
    id: 'air' as const,
    label: 'Air Delivery',
    type: 'Express',
    estimate: '3–7 days',
    fee: 150, // GH₵ — from spec example, isolated (DB has single 15, not per-method)
    expectedDays: { min: 3, max: 7 },
  },
  sea: {
    id: 'sea' as const,
    label: 'Sea Delivery',
    type: 'Standard',
    estimate: '14–30 days',
    fee: 50,
    expectedDays: { min: 14, max: 30 },
  },
} as const

export function getShippingFee(method: ShippingMethod): number {
  return SHIPPING_OPTIONS[method].fee
}

export function getExpectedDeliveryDate(method: ShippingMethod): string {
  const days = method === 'air' ? 5 : 21 // midpoint for expected_delivery_date
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0] // YYYY-MM-DD for deliveries.expected_delivery_date
}

// For display
export function formatShippingLabel(method: ShippingMethod): string {
  const o = SHIPPING_OPTIONS[method]
  return `${o.label} · ${o.type} · ${o.estimate} · GH₵${o.fee}`
}
