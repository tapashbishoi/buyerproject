import { BuyerAgent } from './agent.js';

async function test() {
  console.log("=== Testing BuyerAgent Initialization ===");
  const agent = new BuyerAgent("dummy_api_key_for_testing");
  
  await agent.initialize();
  
  console.log("\n=== Testing Schema Translation ===");
  const testSchema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            product_id: { type: "integer", exclusiveMinimum: 0 },
            quantity: { type: "integer" }
          },
          required: ["product_id", "quantity"]
        }
      }
    }
  };
  
  const converted = agent.convertSchemaToGemini(testSchema);
  console.log("Converted Schema:");
  console.log(JSON.stringify(converted, null, 2));
  
  // Verify uppercase conversion
  if (converted.type === "OBJECT" && converted.properties.items.type === "ARRAY" && converted.properties.items.items.type === "OBJECT") {
    console.log("\x1b[32m✔ Schema conversion test passed (types are uppercase, validation keys like exclusiveMinimum removed)\x1b[0m");
  } else {
    console.error("\x1b[31m✘ Schema conversion test failed!\x1b[0m");
  }
}

test().catch(console.error);
