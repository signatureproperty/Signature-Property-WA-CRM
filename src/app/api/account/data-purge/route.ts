import { NextResponse } from 'next/server';
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { accountId, userId } = await requireRole('admin');
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { target, scope, fromSerial, toSerial, serialList, password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Account password is required for verification.' }, { status: 400 });
    }

    if (target !== 'contacts' && target !== 'listings') {
      return NextResponse.json({ error: 'Invalid purge target. Choose contacts or listings.' }, { status: 400 });
    }

    // Verify user credentials with Supabase Auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authVerifyClient = createClient(supabaseUrl, supabaseAnonKey);

    // Get current user's email using service role or existing session
    const { supabase } = await getCurrentAccount();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user?.email) {
      return NextResponse.json({ error: 'Could not resolve user email for verification.' }, { status: 401 });
    }

    const { error: signInError } = await authVerifyClient.auth.signInWithPassword({
      email: userData.user.email,
      password: password.trim(),
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Incorrect password. Data purge cancelled for security.' },
        { status: 401 }
      );
    }

    const table = target === 'contacts' ? 'contacts' : 'property_listings';
    let deletedCount = 0;

    if (scope === 'all') {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq('account_id', accountId)
        .select('id');

      if (error) throw error;
      deletedCount = data?.length ?? 0;
    } else if (scope === 'range') {
      const fromStr = String(fromSerial || '').trim();
      const toStr = String(toSerial || '').trim();

      const fromNum = parseInt(fromStr.replace(/\D/g, ''), 10);
      const toNum = parseInt(toStr.replace(/\D/g, ''), 10);

      if (isNaN(fromNum) || isNaN(toNum)) {
        return NextResponse.json(
          { error: 'Please provide valid numeric Serial Numbers for the range (e.g. 1 to 50 or C-1 to C-50).' },
          { status: 400 }
        );
      }

      const minNum = Math.min(fromNum, toNum);
      const maxNum = Math.max(fromNum, toNum);

      // Fetch all records for this account to inspect serial numbers
      const { data: rows, error: fetchErr } = await supabase
        .from(table)
        .select('id, serial_no')
        .eq('account_id', accountId);

      if (fetchErr) throw fetchErr;

      const idsToDelete: string[] = [];
      for (const r of rows ?? []) {
        if (!r.serial_no) continue;
        const num = parseInt(r.serial_no.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num >= minNum && num <= maxNum) {
          idsToDelete.push(r.id);
        }
      }

      if (idsToDelete.length > 0) {
        // Chunk deletes by 200
        for (let i = 0; i < idsToDelete.length; i += 200) {
          const chunk = idsToDelete.slice(i, i + 200);
          const { data, error } = await supabase
            .from(table)
            .delete()
            .in('id', chunk)
            .eq('account_id', accountId)
            .select('id');

          if (error) throw error;
          deletedCount += data?.length ?? 0;
        }
      }
    } else if (scope === 'list') {
      const rawList = Array.isArray(serialList)
        ? serialList
        : typeof serialList === 'string'
        ? serialList.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
        : [];

      if (rawList.length === 0) {
        return NextResponse.json({ error: 'No serial numbers provided to delete.' }, { status: 400 });
      }

      // Fetch records matching any of the exact serial numbers or digits
      const { data: rows, error: fetchErr } = await supabase
        .from(table)
        .select('id, serial_no')
        .eq('account_id', accountId);

      if (fetchErr) throw fetchErr;

      const normalizedTargets = new Set(rawList.map((s: string) => s.trim().toLowerCase()));
      const digitTargets = new Set(rawList.map((s: string) => s.replace(/\D/g, '')).filter(Boolean));

      const idsToDelete = (rows ?? [])
        .filter((r) => {
          if (!r.serial_no) return false;
          const sLower = r.serial_no.toLowerCase();
          const sDigits = r.serial_no.replace(/\D/g, '');
          return normalizedTargets.has(sLower) || (sDigits && digitTargets.has(sDigits));
        })
        .map((r) => r.id);

      if (idsToDelete.length > 0) {
        for (let i = 0; i < idsToDelete.length; i += 200) {
          const chunk = idsToDelete.slice(i, i + 200);
          const { data, error } = await supabase
            .from(table)
            .delete()
            .in('id', chunk)
            .eq('account_id', accountId)
            .select('id');

          if (error) throw error;
          deletedCount += data?.length ?? 0;
        }
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      target,
      message: `Successfully purged ${deletedCount} ${target} records.`,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
