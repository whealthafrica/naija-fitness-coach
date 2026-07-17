import { NextResponse } from 'next/server'

export async function POST() {
  return new NextResponse('Not Found', { status: 404 })
}
