import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Default to redirect to verified page, or fallback to home
  const next = searchParams.get('next') || '/verified'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // Exchange the code for a session and save auth cookies
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    console.error('Error exchanging code for session:', error.message)
  }

  // If code exchange fails or is missing, redirect back to sign-in with an error parameter
  return NextResponse.redirect(`${origin}/sign-in?error=AuthCallbackError`)
}
