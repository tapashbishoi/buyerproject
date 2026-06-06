import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { BuyerAgent } from './agent.js';

dotenv.config();

// Prompt for Gemini API Key if not configured and save it to the local .env
async function checkApiKey() {
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.log('\n\x1b[33m[Warning] GEMINI_API_KEY is not configured in your .env file.\x1b[0m');
    const rl = readline.createInterface({ input, output });
    const enteredKey = await rl.question('\x1b[36mPlease paste your Gemini API Key:\x1b[0m ');
    rl.close();
    
    if (!enteredKey || enteredKey.trim() === '') {
      console.error('\x1b[31m[Error] A Gemini API Key is required to power the AI Agent.\x1b[0m');
      process.exit(1);
    }
    
    apiKey = enteredKey.trim();
    
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${apiKey}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${apiKey}`;
    }
    
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('\x1b[32m[System] GEMINI_API_KEY has been successfully written to .env.\x1b[0m\n');
    process.env.GEMINI_API_KEY = apiKey;
  }
  return apiKey.trim();
}

async function main() {
  console.log('\n\x1b[1m\x1b[35m======================================\x1b[0m');
  console.log('\x1b[1m\x1b[35m       AI BUYER AGENT TERMINAL        \x1b[0m');
  console.log('\x1b[1m\x1b[35m======================================\x1b[0m');
  
  const apiKey = await checkApiKey();
  const agent = new BuyerAgent(apiKey);
  
  try {
    await agent.initialize();
  } catch (error) {
    console.error('\x1b[31m[Initialization Error] Failed to initialize agent or connect to seller MCP:\x1b[0m', error.message);
    process.exit(1);
  }
  
  console.log('\n\x1b[32m[System] Buyer Agent is active and connected!\x1b[0m');
  console.log('You can type natural instructions to browse products, check stock, order items, and track order status.');
  console.log('Type \x1b[1mexit\x1b[0m or \x1b[1mquit\x1b[0m to close the terminal session.\n');
  console.log('\x1b[2mSample commands:\x1b[0m');
  console.log(' - "What stationery items are available?"');
  console.log(' - "Check the stock of the Fountain Pen (ID 6)"');
  console.log(' - "Order 5 Blue Pens (ID 1) for John Doe (john@example.com)"');
  console.log(' - "Track order 42"');
  
  const rl = readline.createInterface({ input, output });
  
  while (true) {
    const userInput = await rl.question('\n\x1b[1m\x1b[34mBuyer>\x1b[0m ');
    
    if (userInput.trim().toLowerCase() === 'exit' || userInput.trim().toLowerCase() === 'quit') {
      console.log('\n\x1b[35mExiting session. Goodbye!\x1b[0m');
      break;
    }
    
    if (!userInput.trim()) continue;
    
    try {
      console.log('\x1b[2m[Thinking...] contacting AI agent...\x1b[0m');
      const response = await agent.chat(userInput);
      console.log(`\n\x1b[1m\x1b[32mAgent Response>\x1b[0m\n${response}`);
    } catch (error) {
      console.error('\n\x1b[31m[Agent Execution Error]\x1b[0m', error.message);
    }
  }
  
  rl.close();
}

main().catch(error => {
  console.error('\x1b[31m[Fatal Error]\x1b[0m', error);
});
