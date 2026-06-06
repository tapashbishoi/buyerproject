# AI Buyer Agent

A modern, autonomous AI Buyer Agent built with **Node.js, Express, and the Gemini API**. This agent connects to an external seller's Model Context Protocol (MCP) server to dynamically load tools, browse catalogues, check inventory, and negotiate prices on behalf of the user.

## Features

- **Dynamic Tool Loading:** Automatically fetches and converts JSON Schema tools from the Seller's MCP server.
- **Autonomous Negotiation:** The agent autonomously haggles for the best price using the `negotiate_price` and `accept_counter_offer` tools.
- **Real-Time UI Streaming:** Watch the agent's thought process (🧠) and actions (🔧) stream live in the Web UI via Server-Sent Events (SSE).
- **Proposal Approval Workflow:** Once the agent finds the best deal, it generates a beautiful Proposal Card for the user to "Approve & Buy" with 1 click.
- **Dual Interface:** Run it via the simple terminal CLI or the rich Web UI.

## Prerequisites

- Node.js (v18+)
- A Gemini API Key (`GEMINI_API_KEY`)

## Installation

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

## Usage

### 1. Web UI (Recommended)
Start the express server:
```bash
npm start
```
Open your browser to `http://localhost:4000` and start chatting with your autonomous agent! 
Example prompt: *"I want to buy 10 blue pens. Can you negotiate a 20% discount for me?"*

### 2. Terminal CLI
If you prefer a fast, text-only interface, run:
```bash
node index.js
```

## Architecture
- **`server.js`**: Express backend handling static files and the `/api/chat/stream` SSE endpoint.
- **`agent.js`**: Core AI logic. Manages the Gemini SDK `ChatSession`, fetches MCP tools, handles function calling loops, and triggers `onProgress` callbacks.
- **`public/app.js`**: Frontend logic managing the `EventSource` connection to render the negotiation stream and proposal UI.
