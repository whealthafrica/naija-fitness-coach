const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '.env.local');

function getApiKey() {
  if (!fs.existsSync(envPath)) {
    console.error(`Error: .env.local file not found at ${envPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('NVIDIA_API_KEY=')) {
      return line.split('NVIDIA_API_KEY=')[1].trim();
    }
  }
  return null;
}

function testChatCompletion(apiKey, modelName) {
  return new Promise((resolve) => {
    console.log(`Testing chat completions with model: ${modelName}...`);
    const start = Date.now();
    
    const postData = JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: 'Say hello in exactly three words.' }],
      temperature: 0.2,
      max_tokens: 30,
      stream: false
    });

    const options = {
      hostname: 'integrate.api.nvidia.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 15000 // 15 seconds timeout
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const timeTaken = Date.now() - start;
        console.log(`HTTP Response Status: ${res.statusCode} ${res.statusMessage}`);
        console.log(`Time taken: ${timeTaken}ms`);
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log(`Result: "${parsed.choices?.[0]?.message?.content?.trim()}"`);
            resolve(true);
          } else {
            console.error('API Error Response:', JSON.stringify(parsed, null, 2));
            resolve(false);
          }
        } catch (e) {
          console.error(`Failed to parse response body as JSON. Raw body: ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`Connection error for ${modelName}:`, err.message);
      resolve(false);
    });

    req.on('timeout', () => {
      console.error(`Request for ${modelName} timed out after 15 seconds.`);
      req.destroy();
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Error: NVIDIA_API_KEY not found in .env.local');
    process.exit(1);
  }

  const ok = await testChatCompletion(apiKey, 'z-ai/glm-5.2');
  console.log(`\nTest result: ${ok ? 'SUCCESS' : 'FAILED'}`);
}

main();
