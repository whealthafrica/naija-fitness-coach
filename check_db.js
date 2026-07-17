const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yvvkexvtgysffkfcxeoe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dmtleHZ0Z3lzZmZrZmN4ZW9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzY3NjIyNiwiZXhwIjoyMDk5MjUyMjI2fQ.BrV4rPjwIp9_jMn7UnistXRWWxZiNr7aETemOmLnIRg'; // service role key

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking tables...");
  
  // 1. Check patient_pathway_state table
  const { data: stateData, error: stateError } = await supabase
    .from('patient_pathway_state')
    .select('count')
    .limit(1);
    
  if (stateError) {
    console.log("Error reading patient_pathway_state:", stateError.message);
  } else {
    console.log("patient_pathway_state exists!");
  }

  // 2. Check community_posts table
  const { data: postsData, error: postsError } = await supabase
    .from('community_posts')
    .select('*');
    
  if (postsError) {
    console.log("Error reading community_posts:", postsError.message);
  } else {
    console.log("community_posts exists! Found rows:", postsData.length);
    console.log("Posts data:", postsData);
  }
}

check();
