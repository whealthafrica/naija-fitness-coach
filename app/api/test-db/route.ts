import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabaseUrl = 'https://yvvkexvtgysffkfcxeoe.supabase.co'
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const supabase = createClient(supabaseUrl, supabaseKey)

  const testEmail = 'trigger-test-success@whealthafrica.com'
  let createdUser: any = null

  try {
    // 1. Create a temporary test user via Admin Auth API to trigger handle_new_user()
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
      user_metadata: { name: 'Test Trigger Success' }
    })

    if (createError) {
      return NextResponse.json({
        success: false,
        phase: 'create_user',
        error: createError.message
      })
    }

    createdUser = user

    // 2. Fetch the corresponding profile in public.users
    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    // 3. Fetch the corresponding state in public.patient_pathway_state
    const { data: pathwayState, error: pathwayErr } = await supabase
      .from('patient_pathway_state')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 4. Delete the test user (cleanup)
    if (createdUser) {
      await supabase.auth.admin.deleteUser(createdUser.id)
    }

    return NextResponse.json({
      success: true,
      profile,
      pathwayState,
      errors: {
        profile: profileErr ? profileErr.message : null,
        pathway: pathwayErr ? pathwayErr.message : null
      }
    })
  } catch (err: any) {
    // Attempt cleanup in case of crash
    if (createdUser) {
      await supabase.auth.admin.deleteUser(createdUser.id).catch(() => {})
    }
    return NextResponse.json({ success: false, error: err.message })
  }
}
