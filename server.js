import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { BuyerAgent } from './agent.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global agent instance (for demo purposes, keeping a single chat session)
let agent = null;

// Initialize agent on startup
async function initAgent() {
  try {
    agent = new BuyerAgent();
    await agent.initialize();
    console.log("Agent initialized and connected to MCP.");
  } catch (error) {
    console.error("Failed to initialize agent:", error);
  }
}
initAgent();

app.get('/api/chat/stream', async (req, res) => {
  const message = req.query.message;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!agent) {
    return res.status(503).json({ error: "Agent is not ready yet." });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const reply = await agent.chat(message, onProgress);
    
    let isProposal = false;
    let parsedReply = reply;
    
    const proposalMatch = reply.match(/PROPOSAL_START\n([\s\S]*?)\nPROPOSAL_END/);
    if (proposalMatch) {
      isProposal = true;
      try {
        const proposalData = JSON.parse(proposalMatch[1]);
        res.write(`data: ${JSON.stringify({ type: 'proposal', proposal: proposalData, rawText: parsedReply.replace(proposalMatch[0], '').trim() })}\n\n`);
      } catch (e) {
        console.error("Failed to parse proposal JSON:", e);
      }
    } else {
      res.write(`data: ${JSON.stringify({ type: 'message', text: parsedReply })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Agent execution error:", error);
    res.write(`data: ${JSON.stringify({ type: 'error', text: error.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
