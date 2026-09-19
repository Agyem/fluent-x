import { supabase } from './supabase'

// Exact table/column names from Management System docs — no invention
export type Category = {
  id: string
  name: string
  icon: string | null
  active: boolean
  sequence_order: number | null
}

export type Product = {
  id: string
  name: string
  product_type: 'simple' | 'variable'
  category_id: string | null
  base_price: number | null
  sku: string | null
  sale_price: number | null
  active: boolean
  description?: string | null
}

export type ProductVariant = {
  id: string
  product_id: string
  name: string
  sku: string | null
  price: number
  sale_price: number | null
  active: boolean
}

export type ProductOption = {
  id: string
  product_id: string
  name: string
  sequence_order: number | null
}

export type ProductOptionValue = {
  id: string
  option_id: string
  value: string
  sequence_order: number | null
}

export type VariantOptionValue = {
  variant_id: string
  option_value_id: string
}

export type ProductImage = {
  id: string
  product_id: string
  variant_id: string | null
  storage_path: string
  is_primary: boolean | null
  sequence_order: number | null
}

// 1. Active categories sorted by sequence_order
export async function getActiveCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, icon, active, sequence_order')
    .eq('active', true)
    .order('sequence_order', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Category[]
}

// 2. Active products
export async function getActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, product_type, category_id, base_price, sku, sale_price, active, description')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Product[]
}

// 3. Single product by id (only if active — storefront should not show inactive)
export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, product_type, category_id, base_price, sku, sale_price, active, description')
    .eq('id', id)
    .eq('active', true)
    .single()
  if (error) {
    // PGRST116 = 0 rows (not found / inactive) — return null, not throw
    if ((error as { code?: string }).code === 'PGRST116') return null
    throw error
  }
  return data as Product
}

// 4. Active variants for a product (simple products have hidden "Default" variant — we read it)
export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, product_id, name, sku, price, sale_price, active')
    .eq('product_id', productId)
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProductVariant[]
}

// 5. Options for a product (variable)
export async function getProductOptions(productId: string): Promise<ProductOption[]> {
  const { data, error } = await supabase
    .from('product_options')
    .select('id, product_id, name, sequence_order')
    .eq('product_id', productId)
    .order('sequence_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProductOption[]
}

// 6. Option values for a product's options — accepts optionIds to scope correctly
export async function getProductOptionValues(optionIds: string[]): Promise<ProductOptionValue[]> {
  if (optionIds.length === 0) return []
  const { data, error } = await supabase
    .from('product_option_values')
    .select('id, option_id, value, sequence_order')
    .in('option_id', optionIds)
    .order('sequence_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProductOptionValue[]
}

// Helper: variant -> option_value mapping for a set of variants
export async function getVariantOptionValues(variantIds: string[]): Promise<VariantOptionValue[]> {
  if (variantIds.length === 0) return []
  const { data, error } = await supabase
    .from('variant_option_values')
    .select('variant_id, option_value_id')
    .in('variant_id', variantIds)
  if (error) throw error
  return (data ?? []) as VariantOptionValue[]
}

// 7. Images for a product — ordered, storage_path may not resolve (bucket missing)
export async function getProductImages(productId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('id, product_id, variant_id, storage_path, is_primary, sequence_order')
    .eq('product_id', productId)
    .order('is_primary', { ascending: false })
    .order('sequence_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProductImage[]
}

// Utility: try to build a public URL for a storage_path — returns null if bucket missing or path empty
// Isolated so bucket can be enabled later without rewriting catalogue
export function getPublicImageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null
  // Bucket is documented as 'product-images' — do not create it here
  try {
    const { data } = supabase.storage.from('product-images').getPublicUrl(storagePath)
    // Supabase returns a URL even if bucket/object does not exist — caller should handle 404 fallback via Placeholder
    // We return null only if the SDK cannot construct a URL
    return data?.publicUrl ?? null
  } catch {
    return null
  }
}
