import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { retrieveInventoryKnowledge } from './inventory-knowledge'

function makeDb(rows: Record<string, unknown>[], count = rows.length): SupabaseClient {
  const result = { data: rows, count, error: null }
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    ilike: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => Promise.resolve(result),
    then: (resolve: (val: typeof result) => void) => resolve(result),
  }
  return { from: () => chain } as unknown as SupabaseClient
}

describe('retrieveInventoryKnowledge', () => {
  it('returns active inventory summary when customer only sends a greeting', async () => {
    const db = makeDb(
      [
        { area: 'Bahria Town', city: 'Lahore', property_type: 'House' },
        { area: 'Samanabad', city: 'Lahore', property_type: 'Plot' },
      ],
      1377,
    )
    const out = await retrieveInventoryKnowledge(db, 'acc-1', [
      { role: 'user', content: 'Assalam o Alaikum' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toContain('1377 active listings')
    expect(out[0]).toContain('Bahria Town')
  })

  it('formats matched properties without exposing internal owner phone or notes', async () => {
    const db = makeDb([
      {
        serial_no: 'P-2',
        status: 'available',
        title: '5 Marla Basement in Bahria Town',
        property_type: 'Basement',
        size: '5 Marla',
        demand_price: '1.5 Cr',
        area: 'Bahria Town',
        city: 'Lahore',
        contact_number: '03001112223',
        notes: 'Internal owner commission note',
      },
    ])
    const out = await retrieveInventoryKnowledge(db, 'acc-1', [
      { role: 'user', content: 'Bahria Town mein 5 Marla chahiye' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toContain('P-2 (available): 5 Marla Basement in Bahria Town')
    expect(out[0]).toContain('Demand: 1.5 Cr')
    expect(out[0]).not.toContain('03001112223')
    expect(out[0]).not.toContain('Internal owner commission note')
  })
})

