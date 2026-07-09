import Anthropic from "@anthropic-ai/sdk";

// Lazy singleton so importing this module never throws when the API key is
// absent — routes check isChatConfigured() first and return a clean 503.
let client: Anthropic | null = null;

export function isChatConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropicClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export function getModel() {
  return process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
}
