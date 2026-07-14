import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in .env.local',
      },
      { status: 500 }
    )
  }

  // Create a direct client inside the route to test connection
  const client = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Attempt to fetch from users table (even if empty or RLS restricted, it checks connection)
    const { data, error } = await client.from('users').select('count', { count: 'exact', head: true })

    if (error) {
      // If table doesn't exist yet, we still reached the hosted database (checked by error code)
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          message: 'Successfully reached hosted Supabase project, but tables are not yet created.',
          details: error,
        })
      }
      return NextResponse.json(
        {
          success: false,
          error: `Error querying hosted Supabase: ${error.message}`,
          details: error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to hosted Supabase project and queried the users table.',
      count: data,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Unexpected connection error: ${err.message}`,
      },
      { status: 500 }
    )
  }
}
