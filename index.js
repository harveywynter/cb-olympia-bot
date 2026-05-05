const { Client, GatewayIntentBits } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// ── SYSTEM PROMPT ──────────────────────────────────────────────────────────────
// This is the brain of your bot. Edit this to match your coaching style.
const SYSTEM_PROMPT = `You are the Pivvot AI — a no-nonsense accountability coach built for driven young men aged 18–25 who are serious about building their life.

Your role is to support members across the six pillars of Pivvot: mindset, fitness, diet, personal branding, making money online, and remote work.

Your personality:
- Direct, zero fluff, high standards
- You push people to take action rather than just think about it
- You call out excuses respectfully but firmly
- You celebrate wins but never let people get comfortable
- You talk like a mentor who genuinely wants to see them win — not a corporate chatbot

Rules:
- Never give vague advice. Always be specific and actionable.
- When someone shares a goal, ask what their exact plan is and when they're starting.
- When someone makes an excuse, acknowledge it briefly then redirect to what they CAN control.
- Keep responses concise — 3 to 5 sentences max unless they ask for detail.
- Never use emojis. Never be sycophantic. Never say "great question".
- If someone asks something outside of self-improvement, fitness, mindset, or business — redirect them back to what matters.

You represent the Pivvot standard. Hold it.`;

// ── WHICH CHANNELS THE BOT RESPONDS IN ────────────────────────────────────────
// Add your channel names here. Bot will ONLY respond in these channels.
const ALLOWED_CHANNELS = ['ai-coach', 'accountability', 'pivvot-ai'];

// ── CONVERSATION MEMORY (per user, resets when bot restarts) ──────────────────
const conversationHistory = new Map();
const MAX_HISTORY = 10; // Number of messages to remember per user

client.once('ready', () => {
  console.log(`✅ Pivvot Bot is online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bots
  if (message.author.bot) return;

  // Only respond in allowed channels
  if (!ALLOWED_CHANNELS.includes(message.channel.name)) return;

  // Show typing indicator
  await message.channel.sendTyping();

  try {
    // Get or create conversation history for this user
    const userId = message.author.id;
    if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, []);
    }

    const history = conversationHistory.get(userId);

    // Add the new user message to history
    history.push({
      role: 'user',
      content: message.content,
    });

    // Keep history under limit
    if (history.length > MAX_HISTORY * 2) {
      history.splice(0, 2);
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const reply = response.content[0].text;

    // Add Claude's response to history
    history.push({
      role: 'assistant',
      content: reply,
    });

    // Send the reply — split if over Discord's 2000 char limit
    if (reply.length > 2000) {
      const chunks = reply.match(/[\s\S]{1,2000}/g);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(reply);
    }

  } catch (error) {
    console.error('Error calling Claude API:', error);
    await message.reply('Something went wrong on my end. Try again in a moment.');
  }
});

client.login(process.env.DISCORD_TOKEN);
