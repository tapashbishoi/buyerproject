const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message`;
    msgDiv.innerHTML = `<div class="bubble">${text.replace(/\n/g, '<br>')}</div>`;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message agent-message';
    div.id = 'typing-indicator';
    div.innerHTML = `
        <div class="bubble typing-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function addProposalCard(proposal) {
    const div = document.createElement('div');
    div.className = 'message agent-message';
    
    let itemsHtml = '';
    proposal.items.forEach(item => {
        itemsHtml += `
            <div class="proposal-item">
                <span>${item.quantity}x ${item.name}</span>
                <span>$${item.price * item.quantity}</span>
            </div>
        `;
    });

    let shippingHtml = '';
    if (proposal.shipping_cost !== undefined) {
        shippingHtml = `
            <div class="proposal-item" style="color: #6a0dad; font-style: italic; border-top: 1px dashed #e0d0f0; margin-top: 8px; padding-top: 8px;">
                <span>🚚 Shipping (${proposal.delivery_days || 'Standard'})</span>
                <span>$${proposal.shipping_cost}</span>
            </div>
        `;
    }

    // Make proposal JSON safe for button click
    const safeProposalStr = JSON.stringify(proposal).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    div.innerHTML = `
        <div class="proposal-card">
            <div class="proposal-header">
                📝 Order Proposal
            </div>
            <div class="proposal-items">
                ${itemsHtml}
                ${shippingHtml}
            </div>
            <div class="proposal-total">
                <span>Total Amount:</span>
                <span>$${proposal.totalAmount}</span>
            </div>
            <div class="proposal-reasoning">
                ${proposal.reasoning}
            </div>
            <button class="approve-btn" onclick='approveProposal("${safeProposalStr}")'>
                Approve & Buy
            </button>
        </div>
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

window.approveProposal = function(proposalStr) {
    // Disable all approve buttons after clicking one
    document.querySelectorAll('.approve-btn').forEach(btn => btn.disabled = true);
    
    addMessage("Approved. Please place the order.", 'user');
    sendMessageToAgent("Approved. I am Tapash bishoi (tapash.bishoi@gmail.com). Please place the order now.");
}

async function sendMessageToAgent(messageText) {
    showTypingIndicator();
    
    // Create a new div to hold the streaming logs
    const logDiv = document.createElement('div');
    logDiv.className = 'message system-message';
    logDiv.style.opacity = '0.8';
    logDiv.style.fontSize = '0.85em';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    logDiv.appendChild(bubble);
    
    // Insert before typing indicator
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        chatContainer.insertBefore(logDiv, indicator);
    } else {
        chatContainer.appendChild(logDiv);
    }

    try {
        const url = `/api/chat/stream?message=${encodeURIComponent(messageText)}`;
        const source = new EventSource(url);

        source.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'status') {
                bubble.innerHTML += `<em>${data.content}</em><br>`;
            } else if (data.type === 'thought') {
                bubble.innerHTML += `<strong>🧠 Thinking:</strong> ${data.content.substring(0,100)}...<br>`;
            } else if (data.type === 'tool_call') {
                if (data.name === 'negotiate_price') {
                    const price = data.args.proposed_price || data.args.price || data.args.offer_price || 'a new price';
                    bubble.innerHTML += `<span style="color:#3b82f6;"><strong>💼 Buyer Agent:</strong></span> <em>"I am offering $${price}."</em><br>`;
                } else if (data.name === 'accept_counter_offer') {
                    bubble.innerHTML += `<span style="color:#3b82f6;"><strong>💼 Buyer Agent:</strong></span> <em>"I accept the counter-offer."</em><br>`;
                } else {
                    bubble.innerHTML += `<strong>🔧 Action:</strong> Calling <code>${data.name}</code><br>`;
                }
            } else if (data.type === 'tool_result') {
                if (data.name === 'negotiate_price' && data.result) {
                    let formattedResult = '';
                    
                    // The MCP standard returns { content: [{ type: "text", text: "..." }] }
                    let actualData = data.result;
                    if (data.result.content && Array.isArray(data.result.content) && data.result.content.length > 0) {
                        try {
                            // Try to parse the text string inside the content array as JSON
                            actualData = JSON.parse(data.result.content[0].text);
                        } catch (e) {
                            actualData = data.result.content[0].text;
                        }
                    }

                    if (typeof actualData === 'object') {
                        formattedResult = `<div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; margin-top: 5px; border-left: 3px solid #f59e0b;">`;
                        for (const [key, value] of Object.entries(actualData)) {
                            // If value is still an object, stringify it instead of [object Object]
                            const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
                            formattedResult += `<div style="margin-bottom: 4px;"><strong>${key.replace(/_/g, ' ').toUpperCase()}:</strong> ${displayValue}</div>`;
                        }
                        formattedResult += `</div>`;
                    } else {
                        formattedResult = `<em>"${actualData}"</em>`;
                    }
                    bubble.innerHTML += `<div style="margin-top: 8px;"><span style="color:#f59e0b;"><strong>🤝 Seller Agent:</strong></span><br>${formattedResult}</div>`;
                } else {
                    bubble.innerHTML += `<span style="color:#10b981;"><strong>✅ Result:</strong></span> Success<br>`;
                }
            } else if (data.type === 'proposal') {
                removeTypingIndicator();
                if (data.rawText) addMessage(data.rawText, 'agent');
                addProposalCard(data.proposal);
                source.close();
            } else if (data.type === 'message') {
                removeTypingIndicator();
                addMessage(data.text, 'agent');
                source.close();
            } else if (data.type === 'error') {
                removeTypingIndicator();
                addMessage(`Error: ${data.text}`, 'system');
                source.close();
            } else if (data.type === 'done') {
                removeTypingIndicator();
                source.close();
            }
            
            chatContainer.scrollTop = chatContainer.scrollHeight;
        };
        
        source.onerror = (error) => {
            console.error("SSE Error:", error);
            removeTypingIndicator();
            source.close();
        };

    } catch (error) {
        removeTypingIndicator();
        addMessage(`Connection error: ${error.message}`, 'system');
    }
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;
    
    addMessage(text, 'user');
    userInput.value = '';
    
    sendMessageToAgent(text);
});
