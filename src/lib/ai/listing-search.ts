import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizeContactSearch } from '@/lib/contacts/search-filter'

const STOPWORDS = new Set([
  // English
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'i', 'me', 'my',
  'you', 'your', 'we', 'our', 'they', 'their', 'it', 'its', 'this', 'that', 'these',
  'those', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by', 'about', 'as',
  'and', 'or', 'but', 'if', 'so', 'can', 'could', 'would', 'should', 'will', 'do',
  'does', 'did', 'have', 'has', 'had', 'any', 'all', 'some', 'what', 'which', 'who',
  'how', 'many', 'much', 'give', 'show', 'tell', 'find', 'get', 'list', 'check',
  'update', 'updates', 'detail', 'details', 'info', 'information', 'please', 'pls',
  'latest', 'recent', 'new', 'today', 'customer', 'customers', 'client', 'clients',
  'lead', 'leads', 'deal', 'deals', 'listing', 'listings', 'property', 'properties',
  'message', 'messages', 'chat', 'crm', 'data', 'record', 'records', 'status',
  'want', 'looking', 'need', 'available', 'options', 'option', 'hello', 'hi', 'hey',
  // Roman Urdu / Urdu
  'ka', 'ki', 'ke', 'ko', 'se', 'mein', 'me', 'ma', 'par', 'pe', 'tak', 'hai', 'hain',
  'tha', 'thi', 'the', 'ho', 'hoga', 'hon', 'kya', 'kon', 'kaun', 'konsa', 'assalam',
  'konsi', 'konse', 'kisi', 'koi', 'sab', 'sara', 'sare', 'saare', 'aur', 'or', 'ya',
  'bhi', 'hi', 'to', 'tu', 'tum', 'aap', 'ap', 'hum', 'wo', 'woh', 'ye', 'yeh',
  'is', 'us', 'in', 'un', 'mujhe', 'mujh', 'mera', 'meri', 'mere', 'batao', 'btain',
  'batain', 'bata', 'dikhao', 'dikha', 'nikal', 'nikalo', 'nikalwa', 'nkalwa',
  'chahiye', 'chaheye', 'mil', 'sakta', 'sakti', 'sakte', 'jayega', 'jaye', 'do',
  'de', 'den', 'dein', 'lo', 'le', 'karo', 'karen', 'krdo', 'kar', 'kr', 'rha',
  'raha', 'rahi', 'rahe', 'wala', 'wali', 'wale', 'yar', 'yaar', 'bhai', 'sir',
  'aaj', 'aj', 'kal', 'abhi', 'kitne', 'kitni', 'kitna', 'kahan', 'kidhar',
  'number', 'phone', 'name', 'naam', 'rate', 'price', 'budget', 'wegaira', 'wagaira',
  'salam', 'alaikum', 'walaikum', 'jee', 'ji', 'acha', 'theek', 'haan', 'han',
])

// Map common Roman Urdu real-estate words to English inventory equivalents.
const SYNONYM_MAP: Record<string, string> = {
  ghar: 'House',
  makan: 'House',
  makaan: 'House',
  kothi: 'House',
  dukan: 'Shop',
  dukaan: 'Shop',
  kiraya: 'Rent',
  kiraye: 'Rent',
  lac: 'Lacs',
  lacs: 'Lacs',
  lakh: 'Lacs',
  lakhs: 'Lacs',
  crore: 'Cr',
  karor: 'Cr',
}

export const LISTING_SEARCH_COLUMNS =
  'serial_no, title, property_type, size, demand_price, potential_rent, city, area, address, status, contact_number, storey, front_dimension, length_dimension, documents, utilities, notes, description'

/**
 * Extract clean search tokens from natural-language Roman Urdu / English text.
 * Preserves property serial codes (e.g. P-12), phone digits, and domain keywords.
 */
export function extractSearchTokens(rawQuery: string): string[] {
  const cleaned = rawQuery.replace(/[?!.,;:"()[\]{}]/g, ' ').trim()
  if (!cleaned) return []

  const rawParts = cleaned.split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  const tokens: string[] = []

  for (const part of rawParts) {
    const lower = part.toLowerCase()
    if (STOPWORDS.has(lower)) continue
    const mapped = SYNONYM_MAP[lower] ?? part
    const mappedLower = mapped.toLowerCase()
    const isNumberOrCode = /\d/.test(mapped)
    if (!isNumberOrCode && mapped.length < 2) continue
    if (!seen.has(mappedLower)) {
      seen.add(mappedLower)
      tokens.push(mapped)
    }
  }
  return tokens.slice(0, 6)
}

export function escapePostgrestLike(raw: string): string {
  return raw.replace(/[,()*%]/g, '').replace(/_/g, '\\_').trim()
}

export function buildListingTokenOrClause(token: string): string | null {
  const safe = escapePostgrestLike(sanitizeContactSearch(token))
  if (!safe) return null
  return [
    `serial_no.ilike.*${safe}*`,
    `title.ilike.*${safe}*`,
    `city.ilike.*${safe}*`,
    `area.ilike.*${safe}*`,
    `address.ilike.*${safe}*`,
    `property_type.ilike.*${safe}*`,
    `size.ilike.*${safe}*`,
    `demand_price.ilike.*${safe}*`,
    `notes.ilike.*${safe}*`,
    `description.ilike.*${safe}*`,
  ].join(',')
}

export interface SearchListingsOptions {
  tokens: string[]
  status?: string
  statuses?: string[]
  limit?: number
}

interface ListingFilterQuery {
  eq(column: string, value: string): ListingFilterQuery
  in(column: string, values: string[]): ListingFilterQuery
  or(filters: string): ListingFilterQuery
  order(column: string, opts: { ascending: boolean }): ListingFilterQuery
  limit(count: number): Promise<{ data: Record<string, unknown>[] | null }>
}

function applyStatusFilter(
  q: ListingFilterQuery,
  status?: string,
  statuses?: string[],
): ListingFilterQuery {
  if (status) return q.eq('status', status)
  if (statuses && statuses.length > 0) return q.in('status', statuses)
  return q
}

/**
 * Search `property_listings` scoped to `accountId`.
 * Runs exact `serial_no` match first, then ANDs tokens for precision,
 * falling back to OR if strict AND returns 0 rows.
 */
export async function queryMatchingListings(
  db: SupabaseClient,
  accountId: string,
  opts: SearchListingsOptions,
): Promise<Record<string, unknown>[]> {
  const { tokens, status, statuses, limit = 15 } = opts
  const results: Record<string, unknown>[] = []
  if (tokens.length === 0 && !status && (!statuses || statuses.length === 0)) {
    return results
  }

  // Prioritize exact serial_no match if a token looks like P-12 / L-5
  const serialToken = tokens.find((tok) => /^[a-z]+-\d+$/i.test(tok))
  if (serialToken) {
    const { data: exact } = await db
      .from('property_listings')
      .select(LISTING_SEARCH_COLUMNS)
      .eq('account_id', accountId)
      .ilike('serial_no', serialToken)
      .limit(5)
    if (exact && exact.length > 0) results.push(...exact)
  }

  const activeTokens = tokens.slice(0, 4)
  let andQuery = applyStatusFilter(
    db
      .from('property_listings')
      .select(LISTING_SEARCH_COLUMNS)
      .eq('account_id', accountId) as unknown as ListingFilterQuery,
    status,
    statuses,
  )

  let hasClauses = false
  for (const tok of activeTokens) {
    const clause = buildListingTokenOrClause(tok)
    if (clause) {
      andQuery = andQuery.or(clause)
      hasClauses = true
    }
  }

  if (hasClauses || status || (statuses && statuses.length > 0)) {
    const { data: andRows } = await andQuery
      .order('created_at', { ascending: false })
      .limit(limit)
    if (andRows && andRows.length > 0) {
      const seenSerials = new Set(results.map((r) => String(r.serial_no)))
      for (const r of andRows) {
        if (!seenSerials.has(String(r.serial_no))) results.push(r)
      }
    } else if (activeTokens.length > 1) {
      const orParts = activeTokens
        .map(buildListingTokenOrClause)
        .filter((x): x is string => Boolean(x))
      if (orParts.length > 0) {
        const orQuery = applyStatusFilter(
          (
            db
              .from('property_listings')
              .select(LISTING_SEARCH_COLUMNS)
              .eq('account_id', accountId) as unknown as ListingFilterQuery
          ).or(orParts.join(',')),
          status,
          statuses,
        )
        const { data: orRows } = await orQuery
          .order('created_at', { ascending: false })
          .limit(Math.min(limit, 12))
        if (orRows) results.push(...orRows)
      }
    }
  }

  return results.slice(0, limit)
}
