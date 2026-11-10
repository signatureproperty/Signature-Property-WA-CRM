import type { SupabaseClient } from '@supabase/supabase-js'
import { generateReply } from './generate'
import type { AiConfig, ChatMessage } from './types'
import { contactSearchFilter, sanitizeContactSearch } from '@/lib/contacts/search-filter'
import { latestUserMessage } from './query'
import {
  escapePostgrestLike,
  extractSearchTokens,
  queryMatchingListings,
} from './listing-search'

export { extractSearchTokens }

const CRM_QUERY_PREFIX = '[[CRM_QUERY:'
const CRM_QUERY_REGEX = /\[\[CRM_QUERY:(\{[\s\S]*?\})\]\]/

export interface CrmSnapshot {
  listings: {
    total: number
    available: number
    underOffer: number
    sold: number
    rented: number
    recent: Record<string, unknown>[]
  }
  contacts: {
    total: number
    recent: Record<string, unknown>[]
  }
  deals: {
    total: number
    open: number
    won: number
    lost: number
    openValue: number
    stages: Record<string, unknown>[]
    recent: Record<string, unknown>[]
  }
  conversations: {
    total: number
    open: number
    pending: number
    unreadTotal: number
    recent: Record<string, unknown>[]
  }
}

export interface CrmSearchResults {
  query: string
  tokens: string[]
  listings: Record<string, unknown>[]
  contacts: Record<string, unknown>[]
  deals: Record<string, unknown>[]
  conversations: Record<string, unknown>[]
  messages: Record<string, unknown>[]
}

interface CrmQueryRequest {
  table?: 'listings' | 'contacts' | 'deals' | 'conversations'
  search?: string
  status?: string
}

/**
 * Fetch a lightweight live snapshot of the account's CRM state.
 * Uses the caller's RLS-scoped Supabase client and explicit `account_id` filter.
 */
export async function fetchCrmSnapshot(
  db: SupabaseClient,
  accountId: string,
): Promise<CrmSnapshot> {
  const [
    listingsTotal,
    listingsAvail,
    listingsOffer,
    listingsSold,
    listingsRented,
    recentListings,
    contactsTotal,
    recentContacts,
    dealsRows,
    stagesRows,
    convsTotal,
    convsOpen,
    convsPending,
    recentConvs,
  ] = await Promise.all([
    db.from('property_listings').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
    db.from('property_listings').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('status', 'available'),
    db.from('property_listings').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('status', 'under_offer'),
    db.from('property_listings').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('status', 'sold'),
    db.from('property_listings').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('status', 'rented'),
    db
      .from('property_listings')
      .select('serial_no, title, property_type, size, demand_price, city, area, status, contact_number, notes')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('contacts').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
    db
      .from('contacts')
      .select('id, serial_no, name, phone, email, city, area, property_type, size, budget, notes, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(5),
    db
      .from('deals')
      .select('id, title, value, currency, status, stage_id, expected_close_date, notes, created_at, contact:contacts(name, phone)')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('pipeline_stages').select('id, name, position, pipeline_id').order('position'),
    db.from('conversations').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
    db.from('conversations').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('status', 'open'),
    db.from('conversations').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('status', 'pending'),
    db
      .from('conversations')
      .select('id, status, unread_count, last_message_text, last_message_at, ai_autoreply_disabled, contact:contacts(name, phone)')
      .eq('account_id', accountId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(8),
  ])

  const allDeals = (dealsRows.data ?? []) as Array<{
    id: string
    title: string
    value: number
    currency?: string
    status?: string
    stage_id: string
    expected_close_date?: string
    notes?: string
    contact?: { name?: string; phone?: string } | null
  }>

  let openDeals = 0
  let wonDeals = 0
  let lostDeals = 0
  let openValue = 0
  for (const d of allDeals) {
    if (d.status === 'won') wonDeals += 1
    else if (d.status === 'lost') lostDeals += 1
    else {
      openDeals += 1
      openValue += Number(d.value) || 0
    }
  }

  const recentConvRows = (recentConvs.data ?? []) as Array<{ unread_count?: number }>
  const unreadTotal = recentConvRows.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  return {
    listings: {
      total: listingsTotal.count ?? 0,
      available: listingsAvail.count ?? 0,
      underOffer: listingsOffer.count ?? 0,
      sold: listingsSold.count ?? 0,
      rented: listingsRented.count ?? 0,
      recent: recentListings.data ?? [],
    },
    contacts: {
      total: contactsTotal.count ?? 0,
      recent: recentContacts.data ?? [],
    },
    deals: {
      total: allDeals.length,
      open: openDeals,
      won: wonDeals,
      lost: lostDeals,
      openValue,
      stages: stagesRows.data ?? [],
      recent: allDeals.slice(0, 8),
    },
    conversations: {
      total: convsTotal.count ?? 0,
      open: convsOpen.count ?? 0,
      pending: convsPending.count ?? 0,
      unreadTotal,
      recent: recentConvs.data ?? [],
    },
  }
}

/**
 * Search across property listings, contacts (+ notes/deals/messages), deals, and conversations.
 */
export async function searchCrmData(
  db: SupabaseClient,
  accountId: string,
  opts: { query: string; table?: CrmQueryRequest['table']; status?: string },
): Promise<CrmSearchResults> {
  const tokens = extractSearchTokens(opts.query)
  const results: CrmSearchResults = {
    query: opts.query,
    tokens,
    listings: [],
    contacts: [],
    deals: [],
    conversations: [],
    messages: [],
  }
  if (tokens.length === 0 && !opts.status) return results

  const wantAll = !opts.table
  const wantListings = wantAll || opts.table === 'listings'
  const wantContacts = wantAll || opts.table === 'contacts'
  const wantDeals = wantAll || opts.table === 'deals'
  const wantConversations = wantAll || opts.table === 'conversations'

  // 1. Property listings search
  if (wantListings) {
    results.listings = await queryMatchingListings(db, accountId, {
      tokens,
      status: opts.status,
      limit: 15,
    })
  }

  // 2. Contacts search (+ notes, deals, and recent conversation messages)
  if (wantContacts) {
    const contactOrParts = tokens
      .slice(0, 4)
      .map((tok) => contactSearchFilter(tok, { includeEmail: true, includeRealEstate: true }))
      .filter((x): x is string => Boolean(x))

    if (contactOrParts.length > 0) {
      const { data: contactRows } = await db
        .from('contacts')
        .select('id, serial_no, name, phone, email, city, area, property_type, size, budget, notes, created_at')
        .eq('account_id', accountId)
        .or(contactOrParts.join(','))
        .order('created_at', { ascending: false })
        .limit(10)

      if (contactRows && contactRows.length > 0) {
        results.contacts = contactRows
        const contactIds = contactRows.map((c) => c.id as string)

        const [notesRes, contactDealsRes, contactConvsRes] = await Promise.all([
          db
            .from('contact_notes')
            .select('contact_id, note_text, created_at')
            .in('contact_id', contactIds)
            .order('created_at', { ascending: false })
            .limit(15),
          db
            .from('deals')
            .select('id, title, value, currency, status, stage_id, contact_id, notes, expected_close_date')
            .eq('account_id', accountId)
            .in('contact_id', contactIds)
            .limit(15),
          db
            .from('conversations')
            .select('id, contact_id, status, unread_count, last_message_text, last_message_at')
            .eq('account_id', accountId)
            .in('contact_id', contactIds)
            .limit(10),
        ])

        if (notesRes.data && notesRes.data.length > 0) {
          const notesByContact = new Map<string, unknown[]>()
          for (const n of notesRes.data) {
            const cid = String(n.contact_id)
            const arr = notesByContact.get(cid) ?? []
            arr.push(n)
            notesByContact.set(cid, arr)
          }
          results.contacts = results.contacts.map((c) => ({
            ...c,
            contact_notes: notesByContact.get(String(c.id)) ?? [],
          }))
        }

        if (contactDealsRes.data) results.deals.push(...contactDealsRes.data)

        if (contactConvsRes.data && contactConvsRes.data.length > 0) {
          results.conversations.push(...contactConvsRes.data)
          const convIds = contactConvsRes.data.map((c) => c.id as string)
          const { data: msgRows } = await db
            .from('messages')
            .select('conversation_id, sender_type, content_type, content_text, created_at')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: false })
            .limit(15)
          if (msgRows) results.messages.push(...msgRows)
        }
      }
    }
  }

  // 3. Direct Deals search
  if (wantDeals && tokens.length > 0) {
    const dealOrParts = tokens
      .slice(0, 4)
      .map((tok) => {
        const safe = escapePostgrestLike(sanitizeContactSearch(tok))
        return safe ? `title.ilike.*${safe}*,notes.ilike.*${safe}*` : null
      })
      .filter((x): x is string => Boolean(x))
    if (dealOrParts.length > 0) {
      let dq = db
        .from('deals')
        .select('id, title, value, currency, status, stage_id, notes, expected_close_date, contact:contacts(name, phone)')
        .eq('account_id', accountId)
        .or(dealOrParts.join(','))
      if (opts.status) dq = dq.eq('status', opts.status)
      const { data: dealRows } = await dq.order('created_at', { ascending: false }).limit(10)
      if (dealRows) {
        const seen = new Set(results.deals.map((d) => String(d.id)))
        for (const d of dealRows) {
          if (!seen.has(String(d.id))) results.deals.push(d)
        }
      }
    }
  }

  // 4. Conversations / Messages search
  if (wantConversations && tokens.length > 0) {
    const convOrParts = tokens
      .slice(0, 4)
      .map((tok) => {
        const safe = escapePostgrestLike(sanitizeContactSearch(tok))
        return safe ? `last_message_text.ilike.*${safe}*` : null
      })
      .filter((x): x is string => Boolean(x))
    if (convOrParts.length > 0) {
      let cq = db
        .from('conversations')
        .select('id, status, unread_count, last_message_text, last_message_at, contact:contacts(name, phone)')
        .eq('account_id', accountId)
        .or(convOrParts.join(','))
      if (opts.status) cq = cq.eq('status', opts.status)
      const { data: convRows } = await cq.order('last_message_at', { ascending: false, nullsFirst: false }).limit(8)
      if (convRows) {
        const seen = new Set(results.conversations.map((c) => String(c.id)))
        for (const c of convRows) {
          if (!seen.has(String(c.id))) results.conversations.push(c)
        }
      }
    }
  }

  return results
}

function buildCrmAssistantSystemPrompt(
  snapshot: CrmSnapshot,
  initialSearch: CrmSearchResults,
  extraSearch?: CrmSearchResults | null,
): string {
  const sections: string[] = [
    'You are the internal AI Copilot inside Signature Property WA CRM, assisting the agency owner and team members.',
    'Language & Tone: Reply naturally in the same language the user writes in (Roman Urdu, Urdu, or English). Be concise, well-organized, warm, and practical. Use bullet points when listing properties, contacts, or updates.',
    'Accuracy Rule (STRICT): Only state facts, numbers, phone numbers, prices, serial numbers, deal statuses, and messages that appear in the CRM DATA below. Never guess or invent customer records or properties. If nothing matches in the CRM data, clearly say so.',
    `Optional Live Search Tool: If the user asks about specific records not covered in the pre-fetched results below, you may respond with ONLY a single line in this exact format to run one targeted database lookup:
[[CRM_QUERY:{"table":"listings"|"contacts"|"deals"|"conversations","search":"keyword or serial or phone","status":"optional status"}]]
Otherwise, answer directly using the data below.`,
    `LIVE CRM SNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}`,
    `MATCHED SEARCH RESULTS FOR CURRENT QUESTION:\n${JSON.stringify(initialSearch, null, 2)}`,
  ]

  if (extraSearch) {
    sections.push(`ADDITIONAL LOOKUP RESULTS:\n${JSON.stringify(extraSearch, null, 2)}`)
  }

  return sections.join('\n\n')
}

export function stripCrmQueryMarker(text: string): string {
  return text.replace(CRM_QUERY_REGEX, '').trim()
}

/**
 * Answer an internal CRM team chat message using live Supabase data + the account's configured AI.
 */
export async function answerCrmAssistantQuery(args: {
  db: SupabaseClient
  accountId: string
  config: AiConfig
  messages: ChatMessage[]
}): Promise<{ reply: string; snapshot: CrmSnapshot }> {
  const { db, accountId, config, messages } = args
  const latestQuery = latestUserMessage(messages)

  const [snapshot, initialSearch] = await Promise.all([
    fetchCrmSnapshot(db, accountId),
    searchCrmData(db, accountId, { query: latestQuery }),
  ])

  const systemPrompt = buildCrmAssistantSystemPrompt(snapshot, initialSearch)
  const first = await generateReply({ config, systemPrompt, messages })

  const match = first.text.match(CRM_QUERY_REGEX)
  if (match) {
    let parsed: CrmQueryRequest | null = null
    try {
      parsed = JSON.parse(match[1]) as CrmQueryRequest
    } catch {
      parsed = null
    }

    if (parsed && (parsed.search || parsed.status)) {
      const validTable =
        parsed.table === 'listings' ||
        parsed.table === 'contacts' ||
        parsed.table === 'deals' ||
        parsed.table === 'conversations'
          ? parsed.table
          : undefined

      const extraSearch = await searchCrmData(db, accountId, {
        query: typeof parsed.search === 'string' ? parsed.search : '',
        table: validTable,
        status: typeof parsed.status === 'string' ? parsed.status : undefined,
      })

      const secondPrompt = buildCrmAssistantSystemPrompt(snapshot, initialSearch, extraSearch)
      const second = await generateReply({
        config,
        systemPrompt: secondPrompt,
        messages,
      })
      const cleaned = stripCrmQueryMarker(second.text)
      if (cleaned) {
        return { reply: cleaned, snapshot }
      }
    }
  }

  const fallbackText = stripCrmQueryMarker(first.text)
  return {
    reply: fallbackText || (first.text.includes(CRM_QUERY_PREFIX) ? 'Data fetched — please try phrasing your question more specifically.' : first.text),
    snapshot,
  }
}

