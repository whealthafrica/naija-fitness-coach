const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local file not found.')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      const key = match[1]
      let value = match[2] || ''
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1)
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1)
      }
      process.env[key] = value
    }
  })
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be defined in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const phone = process.argv[2]
const code = process.argv[3]

if (!phone || !code) {
  console.error('Error: Please provide both phone number and SMS code. Example: node scripts/verify-otp.js +2348031234567 123456')
  process.exit(1)
}

async function verifyOtp() {
  console.log(`Verifying OTP for ${phone} with code: ${code}`)
  
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phone.trim(),
    token: code.trim(),
    type: 'sms',
  })

  if (error) {
    console.error('❌ Verification failed:', error.message)
    process.exit(1)
  }

  console.log('✅ Verification successful! Authentication confirmed.')
  console.log('Logged in user details:', {
    id: data.user?.id,
    phone: data.user?.phone,
    role: data.user?.role,
  })
}

verifyOtp()
