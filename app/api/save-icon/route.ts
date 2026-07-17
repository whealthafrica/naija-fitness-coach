import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: Request) {
  try {
    const { base64Data } = await request.json()
    if (!base64Data) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }

    // Remove the data URL prefix if present
    const base64Image = base64Data.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64Image, 'base64')

    const targetPath = path.join(process.cwd(), 'public', 'icon-192.png')
    fs.writeFileSync(targetPath, buffer)

    return NextResponse.json({ success: true, size: buffer.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
