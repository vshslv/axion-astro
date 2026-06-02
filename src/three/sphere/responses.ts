/**
 * Chat-flow vocabulary for the navbar assistant (mirrors the sphere2.0 demo's
 * response banks). Kept next to the sphere so the demo "voice" travels with the
 * demo visual. Re-exported from ./index so the public import path
 * (`../three/sphere`) is unchanged.
 */

export const RESPONSES = [
  "Got it. Pulling that up for you now.",
  "Sure — here's what I'm seeing on your end. Looks like everything's running smoothly.",
  "Let me check that and get back to you in a moment.",
  "Done. Want me to look at anything else?",
  "On it. That should take just a few seconds to process.",
  "Interesting — let me think about how to approach this one.",
];
export const GREETINGS = [
  "Hey! What can I help you with today?",
  "Hi — what's on your mind?",
];
export const THANKS = [
  "Anytime. Let me know if anything else comes up.",
  "Happy to help. Just say the word.",
];

export function pickResponse(text: string): string {
  const t = text.toLowerCase().trim();
  if (/^(hi|hello|hey|yo|hola)\b/.test(t))
    return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  if (/\b(thanks|thank you|cheers|ty)\b/.test(t))
    return THANKS[Math.floor(Math.random() * THANKS.length)];
  return RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
}
