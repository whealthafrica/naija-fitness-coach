import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient as createServerSupabase } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { normalizePhoneNumber } from '@/utils/phone'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // 1. Get authenticated session
    const cookieStore = await cookies()
    const supabase = createServerSupabase(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 })
    }

    const normalizedPhone = normalizePhoneNumber(phone)
    const adminSupabase = createAdminClient(supabaseUrl, supabaseKey)

    // 2. Perform a strict preemptive check on the database for duplicate phone numbers
    const { data: existingUser, error: checkError } = await adminSupabase
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
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

    // 3. Check universal bypass OTP
    const isBypassActive = process.env.ALLOW_UNIVERSAL_TEST_OTP === 'true'

    if (isBypassActive) {
      // --- BYPASS MODE ---
      // Skip GoTrue updateUser entirely (prevents sending SMS and avoids Twilio SMS provider errors)
      return NextResponse.json({ success: true, bypass: true })
    } else {
      // --- NORMAL MODE ---
      // Call updateUser with the normalized phone to send a real SMS code
      const { error: otpError } = await supabase.auth.updateUser({
        phone: normalizedPhone,
      })

      if (otpError) {
        const errorMsg = otpError.message.toLowerCase()
        const isConflict = 
          otpError.code === 'phone_exists' || 
          otpError.code === 'user_already_exists' ||
          errorMsg.includes('already registered') || 
          errorMsg.includes('already exists')

        if (isConflict) {
          return NextResponse.json(
            { error: 'This phone number is already registered to another account. If you believe this is a mistake, contact support.' },
            { status: 400 }
          )
        }

        // Catch SMS provider specific errors
        if (errorMsg.includes('phone provider') || errorMsg.includes('sms')) {
          return NextResponse.json(
            { error: 'SMS provider is not configured on the Supabase Console. For testing, please register this number in Authentication -> Providers -> Phone -> Test Phone Numbers in the dashboard.' },
            { status: 400 }
          )
        }

        // Return a clean fallback error rather than leaking status 422 to false conflicts
        return NextResponse.json(
          { error: `Couldn't send your code right now: ${otpError.message}. Please try again.` },
          { status: 400 }
        )
      }

      return NextResponse.json({ success: true })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
