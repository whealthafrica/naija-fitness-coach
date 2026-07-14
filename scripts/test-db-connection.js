const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Helper to parse .env.local manually
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

async function testConnection() {
  console.log(`Connecting to hosted Supabase: ${supabaseUrl}`)
  
  const tables = ['coaches', 'users', 'pathways', 'patient_pathway_state', 'checkins']
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true })
      if (error) {
        console.log(`❌ Table "${table}": Error -> ${error.message} (Code: ${error.code})`)
      } else {
        console.log(`✅ Table "${table}": Query successful! (Count: ${data})`)
      }
    } catch (err) {
      console.log(`❌ Table "${table}": Unexpected exception -> ${err.message}`)
    }
  }
}

testConnection()
