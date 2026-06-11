import 'dotenv/config';
import { Gemini, LlmAgent, InMemoryRunner, MCPToolset } from '@google/adk';

async function main() {
  const model = new Gemini({ model: 'gemini-2.5-flash' });
  const mcp = new MCPToolset({ 
    type: 'StreamableHTTPConnectionParams', 
    url: 'https://sellerpos.onrender.com/mcp' 
  });

  const agent = new LlmAgent({
    name: 'BuyerAgent',
    model,
    instruction: 'You are a test agent. Search the catalogue for Pens.',
    tools: [mcp]
  });

  const runner = new InMemoryRunner({
    appName: 'buyer-agent',
    agent
  });
  
  const stream = runner.runEphemeral({ 
    userId: 'user1',
    newMessage: { parts: [{ text: 'Show me pens' }] } 
  });
  for await (const event of stream) {
    console.log(`\n--- EVENT TYPE: ${event.type} ---`);
    console.log(JSON.stringify(event, null, 2));
  }
}

main();
