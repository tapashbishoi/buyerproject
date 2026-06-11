# AI Buyer Agent (Smart Ordering & Negotiation)

A modern, autonomous AI Buyer Agent built with **Node.js, TypeScript, Express, and Google's Agent Development Kit (ADK)**. This agent connects to an external seller's Model Context Protocol (MCP) server to dynamically load tools, check buyer profiles, browse catalogues, evaluate shipping costs, and negotiate prices on behalf of the user.

## 💼 Business Case

In a B2B or high-volume B2C procurement environment, purchasing teams spend countless hours manually:
1. Browsing supplier catalogues and checking inventory availability.
2. Cross-referencing fulfillment Distribution Centers (DCs) and calculating landed costs (product + shipping).
3. Engaging in back-and-forth negotiations with suppliers for volume discounts.
4. Managing profile registration and contract approvals.

**The Solution:** The AI Buyer Agent acts as an autonomous procurement assistant. It completely automates the discovery, logistics evaluation, and negotiation phases. By delegating routine procurement tasks to an AI, businesses can drastically reduce operational overhead, secure better pricing through consistent, data-driven haggling, and allow human procurement officers to focus solely on strategic decision-making and final approvals.

## 🏗️ Component AI Stack

- **Framework:** [Google Agent Development Kit (@google/adk)](https://github.com/google/adk-js)
  - Provides enterprise-grade agent orchestration, replacing manual API loops with a robust, strictly-typed `LlmAgent` and `InMemoryRunner`.
- **Model:** Google Gemini (`gemini-2.5-flash`)
  - Acts as the reasoning engine to evaluate trade-offs (e.g., shipping cost vs. unit discount) and formulate negotiation counter-offers.
- **Protocol:** Model Context Protocol (MCP) via `@modelcontextprotocol/sdk`
  - Utilizes `StreamableHTTPConnectionParams` to securely and dynamically discover and execute the seller's REST API tools over HTTP.
- **Backend:** Node.js, Express, TypeScript, Zod
- **Frontend:** Vanilla JS with Server-Sent Events (SSE) for real-time streaming of the agent's thought process.

## 🔄 High-Level Flow (Smart Ordering)

When a user requests to buy an item (e.g., "I want to buy 10 blue pens and negotiate a discount"), the agent executes the following autonomous flow:

1. **Identity & Registration (`get_my_profile`, `register_buyer`)**
   - The agent asks for the user's email to check if they are an existing customer in the seller's system.
   - If missing, it dynamically requests shipping details and registers the buyer.
2. **Product Discovery (`browse_catalogue`)**
   - The agent queries the seller's catalogue to find the requested items, verifying stock and list prices.
3. **Logistics Evaluation (`check_delivery_options`)**
   - The agent queries the seller's fulfillment system to find the nearest Distribution Center (DC), delivery timelines, and associated shipping costs.
4. **Autonomous Negotiation (`negotiate_price`)**
   - Armed with the list price and shipping costs, the agent haggles with the seller's AI to lower the unit cost, optimizing for the lowest total "Landed Cost".
5. **Proposal & Human-in-the-Loop Approval**
   - The agent pauses and presents a final `PROPOSAL` to the user in the UI, detailing the negotiated discount, shipping cost, and total amount.
6. **Execution (`accept_counter_offer`, `place_order`)**
   - Only after the user clicks "Approve" does the agent securely execute the final binding contract tools.

## 🚀 Installation & Usage

### Prerequisites
- Node.js (v18+)
- A Gemini API Key (`GEMINI_API_KEY`)

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables. Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   SELLER_MCP_URL=https://sellerpos.onrender.com/mcp
   PORT=4000
   ```

### Running the App
Start the express server using the updated npm scripts:
```bash
npm start
# or 
npm run server
```

Open your browser to `http://localhost:4000` and start chatting with your autonomous agent! 

### Architecture Files
- **`server.ts`**: Express backend handling static files and the `/api/chat/stream` SSE endpoint.
- **`agent.ts`**: Core AI logic containing the `BuyerAgent` class. Instantiates the ADK `LlmAgent`, `MCPToolset`, and `InMemoryRunner`.
- **`public/app.js`**: Frontend logic managing the `EventSource` connection to render the negotiation stream and proposal UI.

## 🛣️ Road to Production (Enterprise Readiness)

While the migration to the Google Agent Development Kit (ADK) elevated the architecture to an enterprise standard, taking this application to a live production environment requires implementing the following extensions:

1. **Persistent State Management:** 
   - *Current:* We are using the ADK's `InMemoryRunner`, meaning conversation history is lost if the Node process restarts. 
   - *Next Step:* Swap `InMemoryRunner` for the ADK's `DatabaseSessionService` (or `VertexAiSessionService`) to persist chat histories in PostgreSQL/Redis, allowing horizontal scaling across multiple servers.
2. **Authentication & Identity:** 
   - *Current:* The backend assumes the user is inherently authorized.
   - *Next Step:* Implement an identity provider (e.g., Auth0, Azure AD). The ADK natively supports `AuthProviderRegistry` to securely pass authenticated OAuth/JWT tokens down to the Seller's MCP server.
3. **Resilience & Fallbacks:**
   - *Current:* Network errors from the MCP server will propagate up as exceptions.
   - *Next Step:* Utilize the ADK's `PluginManager.runOnModelErrorCallback` to implement automated retry logic and circuit breakers for robust network handling.
4. **Strict Guardrails:**
   - *Current:* We rely on the MCP schema validation and strict prompt engineering.
   - *Next Step:* Write an ADK `BeforeToolCallback` plugin to intercept tool calls *before* they are sent to the MCP server. This middle-layer can enforce strict business policies (e.g., rejecting any `quantity < 0` or preventing out-of-policy discounts) natively within the agent loop.
