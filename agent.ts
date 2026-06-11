import { Gemini, LlmAgent, InMemoryRunner, MCPToolset } from '@google/adk';
import dotenv from 'dotenv';
dotenv.config();

const SELLER_MCP_URL = process.env.SELLER_MCP_URL || "https://sellerpos.onrender.com/mcp";

export class BuyerAgent {
  public runner: InMemoryRunner;
  public agent: LlmAgent;

  constructor() {
    const model = new Gemini({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
    const mcp = new MCPToolset({ 
      type: 'StreamableHTTPConnectionParams', 
      url: SELLER_MCP_URL 
    });

    this.agent = new LlmAgent({
      name: 'BuyerAgent',
      model,
      instruction: "You are a helpful AI Buyer Agent assisting a buyer with placing orders using a Smart Ordering flow. " +
                   "You have direct access to the seller's MCP tools. " +
                   "Your primary goal is to be an autonomous, smart negotiator for the buyer. " +
                   "Instead of asking the user for every step, YOU MUST autonomously execute the following flow: \n" +
                   "1. If you don't know the buyer's email, ask for it. Then use get_my_profile to check if they are registered.\n" +
                   "2. If they are not registered, ask for their full shipping address (street, city, state, zip) and company name, then use register_buyer.\n" +
                   "3. Browse the catalogue based on their intent, find the products, and check the inventory.\n" +
                   "4. USE check_delivery_options to find the fulfillment Distribution Center (DC), shipping cost, and delivery days.\n" +
                   "5. USE the negotiate_price tool to haggle with the seller's AI agent for a lower price. Factor in the shipping cost to get the best landed price!\n" +
                   "6. If the seller provides a counter-offer, DO NOT call accept_counter_offer yet. You must get the user's approval first!\n" +
                   "7. Present a PROPOSAL to the user for approval.\n\n" +
                   "When you are ready to propose an order, you MUST output a JSON block wrapped EXACTLY in PROPOSAL_START and PROPOSAL_END tags, like this:\n" +
                   "PROPOSAL_START\n" +
                   "{\n" +
                   "  \"items\": [{ \"product_id\": 1, \"quantity\": 5, \"name\": \"Blue Pen\", \"price\": 8 }],\n" +
                   "  \"shipping_cost\": 5.50,\n" +
                   "  \"delivery_days\": \"2 days\",\n" +
                   "  \"totalAmount\": 45.50,\n" +
                   "  \"reasoning\": \"I negotiated the price down from $10 to $8 each! Shipping from NY DC is $5.50.\"\n" +
                   "}\n" +
                   "PROPOSAL_END\n\n" +
                   "If the user approves the proposal:\n" +
                   " - If there is a pending counter-offer from the negotiation, call accept_counter_offer immediately.\n" +
                   " - If there was no negotiation and you are buying at list price, call place_order immediately.",
      tools: [mcp]
    });

    this.runner = new InMemoryRunner({
      appName: 'buyer-agent',
      agent: this.agent
    });
  }

  async initialize() {
    console.log(`\x1b[34m[System] Initialized Google ADK Agent connecting to ${SELLER_MCP_URL}...\x1b[0m`);
    // Tools are dynamically resolved by ADK MCPToolset.
  }

  async chat(userId: string, sessionId: string, userMessage: string, onProgress: any) {
    if (onProgress) onProgress({ type: 'status', content: 'Connecting to ADK agent...' });
    
    // We use runAsync to maintain conversational history across turns using ADK's session service
    const stream = this.runner.runAsync({
      userId,
      sessionId,
      newMessage: { parts: [{ text: userMessage }] }
    });

    let finalResponseText = '';

    for await (const event of stream) {
      if ((event as any).errorMessage) {
          if (onProgress) onProgress({ type: 'error', text: (event as any).errorMessage });
          throw new Error((event as any).errorMessage);
      }

      const content = (event as any).content;
      if (!content || !content.parts || content.parts.length === 0) continue;

      for (const part of content.parts) {
        // AI Text response
        if (part.text && content.role === 'model') {
          finalResponseText += part.text;
        }

        // Tool Call initiated by the Model
        if (part.functionCall && content.role === 'model') {
           if (onProgress) {
             let thought = 'Agent decides to call tools...';
             if (part.thoughtSignature) {
                 // For now just show a generic thought, or parse the thoughtSignature if it contains readable text
                 thought = 'Agent decides to call ' + part.functionCall.name + '...';
             }
             onProgress({ type: 'thought', content: thought });
             onProgress({ type: 'tool_call', name: part.functionCall.name, args: part.functionCall.args });
           }
        }

        // Tool Result returned (ADK executes it internally and yields this event)
        if (part.functionResponse && content.role === 'user') {
           if (onProgress) {
             onProgress({ type: 'tool_result', name: part.functionResponse.name, result: part.functionResponse.response });
           }
        }
      }
    }
    
    return finalResponseText;
  }
}
