import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient as createServerSupabase } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json()
    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 })
    }

    // 1. Get authenticated session
    const cookieStore = await cookies()
    const supabase = createServerSupabase(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 })
    }

    const adminSupabase = createAdminClient(supabaseUrl, supabaseKey)

    // 2. Check universal bypass OTP
    const isBypassMode = process.env.ALLOW_UNIVERSAL_TEST_OTP === 'true' && code === '123456'

    // 3. Enforce phone uniqueness check (checks both bypass and normal flow to avoid takeover)
    const { data: existingUser, error: checkError } = await adminSupabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: `Database check error: ${checkError.message}` }, { status: 500 })
    }

    if (existingUser && existingUser.id !== user.id) {
      return NextResponse.json(
        { error: 'This phone number is already registered to another account. If you believe this is a mistake, contact support.' },
        { status: 400 }
      )
    }

    if (isBypassMode) {
      // --- BYPASS MODE ---
      // POC-only phone verification bypass for funding demos and pre-launch testing.
      // Set ALLOW_UNIVERSAL_TEST_OTP to false/delete in production.
      
      // Log bypass use in telemetry_events
      await adminSupabase.from('telemetry_events').insert({
        user_id: user.id,
        event_type: 'poc_phone_bypass',
        metadata: { phone, bypass_code: '123456' }
      })

      // Update auth user profile directly using admin API (skips Twilio SMS delivery/OTP confirmation)
      const { error: updateAuthError } = await adminSupabase.auth.admin.updateUserById(
        user.id,
        { phone, phone_confirm: true }
      )

      if (updateAuthError) {
        return NextResponse.json({ error: `Bypass update failed: ${updateAuthError.message}` }, { status: 500 })
      }

      // Synchronize changes to public.users table
      const { error: updateDbError } = await adminSupabase
        .from('users')
        .update({ phone })
        .eq('id', user.id)

      if (updateDbError) {
        return NextResponse.json({ error: `Bypass database sync failed: ${updateDbError.message}` }, { status: 500 })
      }

      return NextResponse.json({ success: true, bypass: true })
    } else {
      // --- NORMAL MODE ---
      // Verify code against the current session
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'phone_change'
      })

      if (verifyError) {
        return NextResponse.json({ error: verifyError.message }, { status: 400 })
      }

      // Synchronize confirmed phone change to public.users table
      const { error: updateDbError } = await adminSupabase
        .from('users')
        .update({ phone })
        .eq('id', user.id)

      if (updateDbError) {
        return NextResponse.json({ error: `Database sync failed: ${updateDbError.message}` }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
