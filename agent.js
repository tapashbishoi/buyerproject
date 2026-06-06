import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const SELLER_MCP_URL = process.env.SELLER_MCP_URL || "https://sellerpos.onrender.com/mcp";

export class BuyerAgent {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error("Missing GEMINI_API_KEY. Please set it in your .env file.");
    }
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.chatSession = null;   // SDK-managed chat session (handles thought signatures)
    this.tools = [];
    this.rawMcpTools = [];
  }

  // Fetch tools from the seller's MCP server and convert them to Gemini schemas
  async initialize() {
    console.log(`\n\x1b[34m[System] Connecting to Seller MCP at ${SELLER_MCP_URL}...\x1b[0m`);
    const response = await this.callMcp("tools/list");
    if (!response.result || !response.result.tools) {
      throw new Error("Failed to retrieve tools from MCP server.");
    }
    this.rawMcpTools = response.result.tools;
    
    // Map MCP JSON-Schema definitions to Gemini Function Declarations
    this.tools = this.rawMcpTools.map(t => {
      return {
        name: t.name,
        description: t.description,
        parameters: this.convertSchemaToGemini(t.inputSchema)
      };
    });
    
    console.log(`\x1b[32m[System] Successfully loaded ${this.tools.length} tools dynamically from the seller:\x1b[0m`);
    this.tools.forEach(t => console.log(` - \x1b[1m${t.name}\x1b[0m: ${t.description}`));

    // Create the SDK-managed chat session.
    // The SDK automatically preserves thoughtSignatures, function call IDs,
    // and the full conversation history — eliminating the 400 error.
    this.chatSession = this.ai.chats.create({
      model: this.model,
      config: {
        tools: [{ functionDeclarations: this.tools }],
        systemInstruction: "You are a helpful AI Buyer Agent assisting a buyer with placing orders. " +
                          "You have direct access to the seller's MCP tools. " +
                          "Your primary goal is to be an autonomous, smart negotiator for the buyer. " +
                          "Instead of asking the user for every step, YOU MUST autonomously: \n" +
                          "1. Browse the catalogue based on their intent.\n" +
                          "2. Find the best products.\n" +
                          "3. Check the inventory for those items.\n" +
                          "4. USE the negotiate_price tool to haggle with the seller's AI agent for a lower price. Do your best to get a discount!\n" +
                          "5. Accept the counter-offer if it is reasonable.\n" +
                          "6. DO NOT PLACE THE ORDER yet. \n" +
                          "7. Once you have found the best deal, you MUST present a PROPOSAL to the user for approval.\n\n" +
                          "When you are ready to propose an order, you MUST output a JSON block wrapped EXACTLY in PROPOSAL_START and PROPOSAL_END tags, like this:\n" +
                          "PROPOSAL_START\n" +
                          "{\n" +
                          "  \"items\": [{ \"product_id\": 1, \"quantity\": 5, \"name\": \"Blue Pen\", \"price\": 8 }],\n" +
                          "  \"totalAmount\": 40,\n" +
                          "  \"reasoning\": \"I negotiated the price down from $10 to $8 each!\"\n" +
                          "}\n" +
                          "PROPOSAL_END\n\n" +
                          "Only ask for the buyer's full name and email address if they explicitly approve the proposal and you need it to call place_order. If they approve, proceed to call place_order."
      }
    });
  }

  // Convert MCP tool inputSchema type properties to Gemini type format (requires uppercase types)
  convertSchemaToGemini(schema) {
    if (!schema) return undefined;
    const newSchema = { ...schema };
    if (typeof newSchema.type === 'string') {
      newSchema.type = newSchema.type.toUpperCase();
    }
    if (newSchema.properties) {
      const newProps = {};
      for (const [key, val] of Object.entries(newSchema.properties)) {
        newProps[key] = this.convertSchemaToGemini(val);
      }
      newSchema.properties = newProps;
    }
    if (newSchema.items) {
      newSchema.items = this.convertSchemaToGemini(newSchema.items);
    }
    // Remove unsupported validation keys to prevent Gemini SDK validation errors
    delete newSchema.$schema;
    delete newSchema.exclusiveMinimum;
    delete newSchema.maximum;
    delete newSchema.format;
    delete newSchema.pattern;
    return newSchema;
  }

  // Custom HTTP Client for MCP server communication
  async callMcp(method, params = {}, id = 1) {
    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };
    const response = await fetch(SELLER_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`MCP Server HTTP error: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    const lines = text.split("\n");
    const dataLine = lines.find(line => line.startsWith("data: "));
    if (!dataLine) {
      throw new Error(`Invalid response format from MCP server: ${text}`);
    }
    const dataJson = dataLine.slice(6).trim();
    return JSON.parse(dataJson);
  }

  // Call the MCP tool and report results
  async executeTool(name, args) {
    console.log(`\n\x1b[33m[Action] Calling seller tool '${name}' with args:\x1b[0m`, JSON.stringify(args, null, 2));
    const result = await this.callMcp("tools/call", {
      name,
      arguments: args
    });
    if (result.error) {
      console.log(`\x1b[31m[Result] Tool returned error: ${result.error.message || JSON.stringify(result.error)}\x1b[0m`);
      return { error: result.error.message || result.error };
    }
    console.log(`\x1b[32m[Result] Tool call succeeded.\x1b[0m`);
    return result.result;
  }

  // Main agent conversation loop — uses SDK chat session for automatic
  // thought-signature management (fixes the 400 Bad Request error).
  async chat(userMessage, onProgress = null) {
    let loopCount = 0;
    const maxLoops = 10;

    if (onProgress) onProgress({ type: 'status', content: 'Connecting to AI agent...' });
    let response = await this.chatSession.sendMessage({ message: userMessage });

    while (loopCount < maxLoops) {
      loopCount++;

      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        let text = "";
        try { text = response.text || ""; } catch (e) { }
        if (text) {
          console.log(`\n\x1b[36m[Thought/Reasoning]\x1b[0m\n${text}`);
          if (onProgress) onProgress({ type: 'thought', content: text });
        } else {
          console.log(`\n\x1b[36m[Thought/Reasoning]\x1b[0m\nAgent decides to call tools...`);
          if (onProgress) onProgress({ type: 'thought', content: 'Agent decides to call tools...' });
        }

        const toolResponses = [];
        for (const call of functionCalls) {
          if (onProgress) onProgress({ type: 'tool_call', name: call.name, args: call.args });
          const toolResult = await this.executeTool(call.name, call.args);
          if (onProgress) onProgress({ type: 'tool_result', name: call.name, result: toolResult });
          
          toolResponses.push({
            functionResponse: {
              name: call.name,
              response: { result: toolResult }
            }
          });
        }

        response = await this.chatSession.sendMessage({ message: toolResponses });

      } else {
        let text = "";
        try { text = response.text || ""; } catch (e) { }
        return text;
      }
    }

    throw new Error("Exceeded maximum tool execution loop limit.");
  }
}
