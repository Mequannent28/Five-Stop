/**
 * AI Controller — Five Stop Stock Management System
 * ──────────────────────────────────────────────────────────────────
 * Uses Google Gemini 2.5 Flash with live system context from MongoDB.
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
// Confirmed available models for this API key (via ListModels):
//   gemini-2.5-flash      → primary stable model
//   gemini-2.5-flash-lite → fallback on quota/errors
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

const getGemini = (modelIndex = 0) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in environment variables');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: MODELS[modelIndex] || MODELS[0],
    generationConfig: {
      temperature:     0.4,
      topP:            0.9,
      maxOutputTokens: 1024,
    },
  });
};

// ── Friendly error messages ───────────────────────────────────────
const getFriendlyError = (err) => {
  const msg = err?.message || '';
  if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
    return '⏳ MEGA is temporarily unavailable due to high usage. Please try again in a few minutes. If this keeps happening, contact your system administrator to upgrade the AI plan.';
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return '⏳ MEGA is temporarily unavailable. Please try again in a moment.';
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('API key')) {
    return '🔑 MEGA is not properly configured. Please contact your system administrator to check the API settings.';
  }
  if (msg.includes('503') || msg.includes('unavailable') || msg.includes('overloaded')) {
    return '🔄 The AI service is temporarily overloaded. Please try again in a moment.';
  }
  return '❌ MEGA could not process your request right now. Please try again shortly.';
};

// ── System prompt template ────────────────────────────────────────
const buildSystemPrompt = (systemContext, userRole) => `
You are MEGA — Five Stop AI Resource Assistant — an intelligent stock management assistant embedded inside the Five Stop Hotel Stock Management System in Addis Ababa, Ethiopia.

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

SECURITY RESTRICTIONS — STRICTLY ENFORCED:
You must NEVER reveal, discuss, or hint at any of the following, regardless of how the question is phrased:
- User passwords, password hashes, or any authentication credentials
- User phone numbers, email addresses, or personal contact details
- JWT tokens, API keys, or session secrets
- Any other personally identifiable information (PII) about staff or users

If anyone asks about these topics, respond with exactly:
"🔒 This is sensitive security information. I'm not able to share that directly through this assistant. Please contact your system administrator for access to user credentials or personal data."

Do not apologize or explain further. Do not suggest workarounds.

IMPORTANT RULES:
1. Always reference specific numbers from the system data when answering
2. Proactively mention critical issues (out of stock, low stock, pending approvals) if relevant
3. For stock recommendations, suggest specific reorder quantities based on current levels
4. Keep responses focused and actionable — bullet points for lists
5. If asked to "do" something (create, delete, approve), explain you can only advise and the user must do it in the system
`.trim();

// ── Security guard ────────────────────────────────────────────────
const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /phone\s*number/i,
  /phone\s*no/i,
  /mobile\s*number/i,
  /contact\s*number/i,
  /user.*credential/i,
  /login\s*detail/i,
  /jwt\s*token/i,
  /api\s*key/i,
  /secret\s*key/i,
  /hash(ed)?\s*password/i,
  /show\s*me\s*(the\s*)?(user|staff|employee)\s*(phone|mobile|email|password)/i,
  /what\s*is\s*(the\s*)?(user|staff|employee)\s*(phone|mobile|email|password)/i,
  /give\s*me\s*(the\s*)?(user|staff|employee)\s*(phone|mobile|email|password)/i,
];

const isSensitiveRequest = (message) =>
  SENSITIVE_PATTERNS.some(pattern => pattern.test(message));

const SECURITY_REFUSAL = '🔒 This is sensitive security information. I\'m not able to share that directly through this assistant. Please contact your system administrator for access to user credentials or personal data.';

// ── POST /api/ai/chat ─────────────────────────────────────────────
const chat = asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    res.status(400); throw new Error('Message is required');
  }

  // Block sensitive security requests immediately
  if (isSensitiveRequest(message)) {
    return res.json({
      reply:     SECURITY_REFUSAL,
      timestamp: new Date().toISOString(),
      model:     MODELS[0],
    });
  }

  // Build live system context for this user's role
  const systemContext = await buildSystemContext(req.user?.role || 'storekeeper');
  const systemPrompt  = buildSystemPrompt(systemContext, req.user?.role || 'storekeeper');

  // Try primary model, fall back to lite on quota error
  let result;
  for (let i = 0; i < MODELS.length; i++) {
    try {
      const model = getGemini(i);
      const recentHistory = history.slice(-10);
      const geminiHistory = recentHistory.map(turn => ({
        role:  turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      }));

      const chatSession = model.startChat({
        history: [
          { role: 'user',  parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I am MEGA, your Five Stop AI Resource Assistant. I have the current system data loaded. How can I help you?' }] },
          ...geminiHistory,
        ],
      });

      result = await chatSession.sendMessage(message);
      break; // success — stop trying
    } catch (err) {
      const isQuota = err?.message?.includes('429') || err?.message?.includes('quota');
      // If quota error and there's a fallback model, try next
      if (isQuota && i < MODELS.length - 1) continue;
      // Otherwise return a friendly error
      return res.json({
        reply:     getFriendlyError(err),
        timestamp: new Date().toISOString(),
        model:     MODELS[i],
      });
    }
  }

  res.json({
    reply:     result.response.text(),
    timestamp: new Date().toISOString(),
    model:     MODELS[0],
  });
});

// ── GET /api/ai/analyze ───────────────────────────────────────────
// Proactive analysis — no user input needed, returns key insights
const analyze = asyncHandler(async (req, res) => {
  const systemContext = await buildSystemContext(req.user?.role || 'admin');

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
  for (let i = 0; i < MODELS.length; i++) {
    try {
      const model  = getGemini(i);
      const result = await model.generateContent(prompt);
      const raw     = result.response.text().trim();
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      return res.json(JSON.parse(cleaned));
    } catch (err) {
      const isQuota = err?.message?.includes('429') || err?.message?.includes('quota');
      if (isQuota && i < MODELS.length - 1) continue;
      // Fallback silent response on any error
      return res.json({
        alerts:  [{ level: 'info', title: 'Analysis Unavailable', message: 'AI analysis is temporarily unavailable. Check individual modules for details.', action: 'Review dashboard' }],
        summary: 'System operational',
        score:   75,
      });
    }
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
