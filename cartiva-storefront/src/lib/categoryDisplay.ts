// Normalize DB category names to customer-facing display names
// Real DB IDs are always used — only display names are normalized
const DISPLAY_MAP: Record<string, string> = {
  'PHONES': 'Smartphones',
  'LAPTOPS': 'Laptops',
  'HOME APPLIANCE': 'Home Appliances',
  'fashion': 'Accessories',
  // Audio & Wearables is intended but not yet in DB — will appear when DB has it
  'AUDIO & WEARABLES': 'Audio & Wearables',
}

export function displayCategoryName(name: string): string {
  const key = name.trim()
  return DISPLAY_MAP[key] ?? DISPLAY_MAP[key.toUpperCase()] ?? key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
}

// Intended customer-facing structure (for reference, not hardcoded IDs)
export const INTENDED_CATEGORIES = [
  'Smartphones',
  'Laptops',
  'Audio & Wearables',
  'Accessories',
  'Home Appliances',
] as const
