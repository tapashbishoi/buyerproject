// Using native global fetch in Node 18+

async function callMcpMethod(method, params = {}, id = 1) {
  const payload = {
    jsonrpc: "2.0",
    id,
    method,
    params
  };
  const response = await fetch("https://sellerpos.onrender.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }
  const text = await response.text();
  
  // Find the data line in SSE output
  const lines = text.split("\n");
  const dataLine = lines.find(line => line.startsWith("data: "));
  if (!dataLine) {
    throw new Error(`Invalid response format: ${text}`);
  }
  const dataJson = dataLine.slice(6).trim();
  return JSON.parse(dataJson);
}

async function test() {
  console.log("Fetching tools...");
  const tools = await callMcpMethod("tools/list");
  console.log("Tools received. Listing browse_catalogue tool info:");
  console.log(JSON.stringify(tools.result.tools.find(t => t.name === "browse_catalogue"), null, 2));

  console.log("\nTesting browse_catalogue...");
  const catalogue = await callMcpMethod("tools/call", {
    name: "browse_catalogue",
    arguments: {}
  });
  console.log("Catalogue response:");
  console.log(JSON.stringify(catalogue, null, 2));
}

test().catch(console.error);
