import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Setup standard response headers
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Bypass redirects in Preview Mode for local review ONLY if not in production
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
  if (isPreview) {
    return response
  }

  const { pathname } = request.nextUrl

  // Ignore static assets, favicon, Next.js internal files, and authentication callbacks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth/callback') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)
  ) {
    return response
  }

  // Create the Supabase client inside the middleware context
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },

      },
    }
  )

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  // Scenario A: User is not authenticated
  if (!user) {
    if (pathname === '/coach/login') {
      return response
    }
    if (pathname.startsWith('/coach/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/coach/login'
      return NextResponse.redirect(url)
    }

    // Allow patient entry points for signing in
    if (
      pathname === '/sign-in' ||
      pathname === '/email' ||
      pathname === '/phone' ||
      pathname === '/verify'
    ) {
      return response
    }
    // Redirect all other pages back to sign-in
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // Scenario B: User is authenticated
  // Query their profile state directly from Supabase
  const { data: profile } = await supabase
    .from('users')
    .select('phone, condition, coach_id, role')
    .eq('id', user.id)
    .single()

  const isCoachOrAdmin = profile?.role === 'coach' || profile?.role === 'superadmin'

  if (isCoachOrAdmin) {
    if (pathname.startsWith('/coach/')) {
      if (pathname === '/coach/login') {
        const url = request.nextUrl.clone()
        url.pathname = '/coach/dashboard'
        return NextResponse.redirect(url)
      }
      return response
    }
    // Redirect coach/admin trying to visit patient app to coach dashboard
    const url = request.nextUrl.clone()
    url.pathname = '/coach/dashboard'
    return NextResponse.redirect(url)
  }

  // User is a patient
  if (pathname.startsWith('/coach/') && pathname !== '/coach/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  const hasPhone = profile?.phone && profile.phone !== ''
  const hasCondition = profile?.condition && profile.condition !== ''
  const hasCoach = profile?.coach_id && profile.coach_id !== null

  const isOnboardingPage =
    pathname === '/sign-in' ||
    pathname === '/email' ||
    pathname === '/phone' ||
    pathname === '/verify' ||
    pathname === '/verified' ||
    pathname === '/condition' ||
    pathname === '/coach'

  // 2. Strict Onboarding Sequential Redirects
  if (!hasPhone) {
    // User must enter and verify a phone number first
    if (pathname === '/phone' || pathname === '/verify') {
      return response
    }
    const url = request.nextUrl.clone()
    url.pathname = '/phone'
    return NextResponse.redirect(url)
  }

  if (!hasCondition) {
    // User must select their focus condition next
    if (pathname === '/condition' || pathname === '/verified') {
      return response
    }
    const url = request.nextUrl.clone()
    url.pathname = '/condition'
    return NextResponse.redirect(url)
  }

  if (!hasCoach) {
    // User must meet and assign their coach next
    if (pathname === '/coach') {
      return response
    }
    const url = request.nextUrl.clone()
    url.pathname = '/coach'
    return NextResponse.redirect(url)
  }

  // 3. Prevent fully onboarded users from returning to onboarding screens
  if (isOnboardingPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any image/asset files in public
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
