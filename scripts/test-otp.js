const { createClient } = require('@supabase/supabase-js')
const readline = require('readline')
const fs = require('fs')
const path = require('path')

// Helper to parse .env.local manually
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local file not found. Please create it first.')
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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

console.log(`Connecting to: ${supabaseUrl}`)

rl.question('Enter your phone number in international format (e.g. +2348031234567): ', async (phone) => {
  if (!phone.trim()) {
    console.error('Phone number cannot be empty.')
    rl.close()
    return
  }

  console.log(`\nSending OTP to ${phone}...`)
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: phone.trim(),
  })

  if (error) {
    console.error('Error sending OTP:', error.message)
    console.log('\n--- Troubleshooting ---')
    console.log('1. Ensure Phone auth is enabled in your Supabase Auth Providers dashboard.')
    console.log('2. Confirm that an SMS provider (like Twilio, MessageBird, etc.) is configured.')
    console.log('   (If you are using the default Twilio sandbox provider, you can only send to pre-verified numbers.)')
    rl.close()
    return
  }

  console.log('OTP sent successfully! Check your phone.')

  rl.question('Enter the 6-digit verification code: ', async (token) => {
    if (!token.trim()) {
      console.error('Verification code cannot be empty.')
      rl.close()
      return
    }

    console.log('\nVerifying OTP...')
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: token.trim(),
      type: 'sms',
    })

    if (verifyError) {
      console.error('Verification failed:', verifyError.message)
    } else {
      console.log('Verification successful! You are logged in.')
      console.log('User ID:', verifyData.user?.id)
      console.log('Phone:', verifyData.user?.phone)
    }
    rl.close()
  })
})
