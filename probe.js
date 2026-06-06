import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function run() {
  console.log("Connecting to seller MCP server...");
  const transport = new SSEClientTransport(new URL("https://sellerpos.onrender.com/mcp"));
  const client = new Client(
    {
      name: "probe-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  console.log("Connected successfully! Fetching tools list...");

  const response = await client.listTools();
  console.log("\n--- Available Tools ---");
  console.log(JSON.stringify(response, null, 2));

  await transport.close();
  console.log("Connection closed.");
}

run().catch((error) => {
  console.error("Error connecting to MCP server:", error);
});
