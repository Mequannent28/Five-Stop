/**
 * AI Controller — Five Stop Stock Management System
 * ──────────────────────────────────────────────────────────────────
 * Uses Google Gemini 3.6 Flash with live system context from MongoDB.
 * Each request gets a fresh snapshot so the AI always has current data.
 *
 * Endpoints:
 *   POST /api/ai/chat      — main chat with system context
 *   GET  /api/ai/analyze   — proactive automated analysis (no user input)
 */

const asyncHandler = require('express-async-handler');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildSystemContext } = require('../utils/systemContextService');

// ── Gemini setup ─────────────────────────────────────────────────
const getGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in environment variables');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    generationConfig: {
      temperature:     0.4,
      topP:            0.9,
      maxOutputTokens: 1024,
    },
  });
};

// ── System prompt template ────────────────────────────────────────
const buildSystemPrompt = (systemContext, userRole) => `
You are FARA — Five Stop AI Resource Assistant — an intelligent stock management assistant embedded inside the Five Stop Hotel Stock Management System in Addis Ababa, Ethiopia.

Your job is to help hotel staff understand their stock, identify problems, suggest actions, and answer questions about inventory, purchases, suppliers, consumption, and staff.

PERSONALITY:
- Professional, concise, and friendly
- Always ground your answers in the LIVE SYSTEM DATA provided below
- Use Ethiopian Birr (ETB) for all monetary values
- If asked about something not in your context, say so clearly
- Never make up data — always cite what you see in the system
- Respond in the same language the user writes in (English or Amharic)

USER ROLE: ${userRole.toUpperCase()}
${userRole === 'storekeeper' ? '(You can see stock and transactions but NOT financial summaries or staff data)' : ''}
${userRole === 'manager' ? '(You can see all operational data including purchases, consumption, suppliers)' : ''}
${userRole === 'admin' ? '(You have full system visibility including staff, financial data, and all modules)' : ''}

LIVE SYSTEM DATA (updated right now):
${systemContext}

IMPORTANT RULES:
1. Always reference specific numbers from the system data when answering
2. Proactively mention critical issues (out of stock, low stock, pending approvals) if relevant
3. For stock recommendations, suggest specific reorder quantities based on current levels
4. Keep responses focused and actionable — bullet points for lists
5. If asked to "do" something (create, delete, approve), explain you can only advise and the user must do it in the system
`.trim();

// ── POST /api/ai/chat ─────────────────────────────────────────────
const chat = asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    res.status(400); throw new Error('Message is required');
  }

  // Build live system context for this user's role
  const systemContext = await buildSystemContext(req.user?.role || 'storekeeper');
  const systemPrompt  = buildSystemPrompt(systemContext, req.user?.role || 'storekeeper');

  const model = getGemini();

  // Build chat history for Gemini (max last 10 turns to stay token-efficient)
  const recentHistory = history.slice(-10);
  const geminiHistory = recentHistory.map(turn => ({
    role:  turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }));

  // Start chat session with system context injected as first user turn
  const chatSession = model.startChat({
    history: [
      // Inject system context as the opening context message
      { role: 'user',  parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I am FARA, your Five Stop AI Resource Assistant. I have the current system data loaded. How can I help you?' }] },
      ...geminiHistory,
    ],
  });

  const result   = await chatSession.sendMessage(message);
  const response = result.response.text();

  res.json({
    reply:     response,
    timestamp: new Date().toISOString(),
    model:     'gemini-3.6-flash',
  });
});

// ── GET /api/ai/analyze ───────────────────────────────────────────
// Proactive analysis — no user input needed, returns key insights
const analyze = asyncHandler(async (req, res) => {
  const systemContext = await buildSystemContext(req.user?.role || 'admin');
  const model = getGemini();

  const prompt = `
${buildSystemPrompt(systemContext, req.user?.role || 'admin')}

---
TASK: Perform a quick automated stock health analysis.
Respond with a JSON object in this exact format:
{
  "alerts": [
    { "level": "critical|warning|info", "title": "...", "message": "...", "action": "..." }
  ],
  "summary": "One sentence overall status",
  "score": 0-100
}

Focus on: out of stock items, low stock, pending purchase approvals, high-value stock issues.
Return ONLY valid JSON, no markdown, no extra text.
`.trim();

  try {
    const result   = await model.generateContent(prompt);
    const raw      = result.response.text().trim();
    // Strip markdown code blocks if present
    const cleaned  = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    const parsed   = JSON.parse(cleaned);
    res.json(parsed);
  } catch (err) {
    // Fallback if JSON parsing fails
    res.json({
      alerts:  [{ level: 'info', title: 'Analysis Ready', message: 'System is running. Check individual modules for details.', action: 'Review dashboard' }],
      summary: 'System operational',
      score:   75,
    });
  }
});

// ── GET /api/ai/quick-suggestions ────────────────────────────────
// Returns 4 suggested questions based on current system state
const quickSuggestions = asyncHandler(async (req, res) => {
  const systemContext = await buildSystemContext(req.user?.role || 'storekeeper');

  // Parse critical data for dynamic suggestions
  const hasLowStock   = systemContext.includes('Low Stock') && !systemContext.includes('Low Stock (below reorder): 0');
  const hasOutOfStock = systemContext.includes('Out of Stock: 0') === false;
  const hasPending    = systemContext.includes('Pending Requests: 0') === false;

  const base = [
    "What is our current stock status?",
    "Which materials need restocking urgently?",
    "Show me this month's purchase summary",
    "What are our top valued inventory items?",
    "Analyze our consumption patterns this month",
    "Which suppliers should we contact for restocking?",
    "What's the total value of our current inventory?",
    "Are there any pending purchase approvals?",
  ];

  const dynamic = [];
  if (hasOutOfStock) dynamic.unshift("Which items are completely out of stock?");
  if (hasLowStock)   dynamic.unshift("Which items are running low and need reordering?");
  if (hasPending)    dynamic.unshift("What stock requests are waiting for approval?");

  const suggestions = [...new Set([...dynamic, ...base])].slice(0, 5);
  res.json({ suggestions });
});

module.exports = { chat, analyze, quickSuggestions };
