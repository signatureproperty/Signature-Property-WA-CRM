import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage } from './types'
import { extractSearchTokens, queryMatchingListings } from './listing-search'

function formatListingForCustomer(row: Record<string, unknown>): string {
  const parts: string[] = []
  const serial = row.serial_no ? String(row.serial_no) : 'Property'
  const status = row.status ? String(row.status) : 'available'
  const title = row.title ? String(row.title) : 'Untitled'
  parts.push(`${serial} (${status}): ${title}`)

  const specs: string[] = []
  if (row.property_type) specs.push(`Type: ${row.property_type}`)
  if (row.size) specs.push(`Size: ${row.size}`)
  if (row.demand_price) specs.push(`Demand: ${row.demand_price}`)
  if (row.potential_rent) specs.push(`Potential Rent: ${row.potential_rent}`)
  if (specs.length > 0) parts.push(specs.join(' | '))

  const loc: string[] = []
  if (row.area) loc.push(String(row.area))
  if (row.city) loc.push(String(row.city))
  if (row.address) loc.push(String(row.address))
  if (loc.length > 0) parts.push(`Location: ${loc.join(', ')}`)

  const details: string[] = []
  if (row.storey) details.push(`Storey: ${row.storey}`)
  if (row.front_dimension || row.length_dimension) {
    details.push(
      `Dimensions: ${row.front_dimension ?? '?'} x ${row.length_dimension ?? '?'}`,
    )
  }
  if (row.documents) details.push(`Docs: ${row.documents}`)
  if (row.utilities) details.push(`Utilities: ${row.utilities}`)
  if (details.length > 0) parts.push(details.join(' | '))

  if (row.description) parts.push(`Details: ${String(row.description).slice(0, 220)}`)

  // Intentionally omit internal owner `contact_number` and internal `notes`
  // from customer-facing WhatsApp context.
  return parts.join('\n')
}

/**
 * Retrieve matching available property listings based on a customer's
 * conversation requirements so the WhatsApp AI bot / draft assistant can
 * share accurate options directly. Best-effort: returns [] on any error.
 */
export async function retrieveInventoryKnowledge(
  db: SupabaseClient,
  accountId: string,
  messages: ChatMessage[],
  limit = 8,
): Promise<string[]> {
  try {
    const customerQuery = messages
      .filter((m) => m.role === 'user')
      .slice(-4)
      .map((m) => m.content)
      .join(' ')

    const tokens = extractSearchTokens(customerQuery)

    // When customer just greeted ("Salam", "Hi") with no requirement keywords,
    // summarize top available areas & types so the bot greets warmly and asks
    // for their requirements instead of handing off.
    if (tokens.length === 0) {
      const { data: sample, count, error } = await db
        .from('property_listings')
        .select('area, city, property_type', { count: 'exact' })
        .eq('account_id', accountId)
        .in('status', ['available', 'under_offer'])
        .order('created_at', { ascending: false })
        .limit(30)

      if (error || !count) return []

      const areas = [...new Set((sample ?? []).map((r) => r.area).filter(Boolean))].slice(0, 8)
      const types = [...new Set((sample ?? []).map((r) => r.property_type).filter(Boolean))].slice(0, 6)
      return [
        `Available Property Inventory Summary: We have ${count} active listings available` +
          (areas.length > 0 ? ` across areas such as ${areas.join(', ')}` : '') +
          (types.length > 0 ? ` (types: ${types.join(', ')})` : '') +
          `. Greet the customer warmly and ask for their preferred area/society, size, property type, and budget so we can suggest matching options.`,
      ]
    }

    const matched = await queryMatchingListings(db, accountId, {
      tokens,
      statuses: ['available', 'under_offer'],
      limit,
    })

    if (matched.length > 0) {
      return matched.map(formatListingForCustomer)
    }

    // No exact match found — check if the account has listings at all so the bot
    // politely offers alternatives / asks to adjust requirements instead of handing off.
    const { count } = await db
      .from('property_listings')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .in('status', ['available', 'under_offer'])

    if (!count) return []

    return [
      `No exact available property listing matched "${tokens.join(' ')}" out of ${count} active listings. ` +
        `Politely let the customer know we don't have an exact match on hand for those exact filters, ` +
        `and ask if they'd like options in nearby areas, a slightly different size/budget, or if they'd like to speak with our property advisor.`,
    ]
  } catch (err) {
    console.warn('[ai inventory] lookup failed (continuing without inventory):', err)
    return []
  }
}

