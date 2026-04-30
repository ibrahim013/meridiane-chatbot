import { MemorySession } from "@openai/agents";

const sessions = new Map<string, MemorySession>();

function maxSessions(): number {
  const raw = process.env.MAX_IN_MEMORY_SESSIONS;
  if (raw === undefined || raw === "") return 500;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 500;
}

export function getMemorySession(conversationId: string): MemorySession {
  const existing = sessions.get(conversationId);
  if (existing) {
    sessions.delete(conversationId);
    sessions.set(conversationId, existing);
    return existing;
  }

  const cap = maxSessions();
  while (sessions.size >= cap) {
    const oldest = sessions.keys().next().value;
    if (oldest === undefined) break;
    sessions.delete(oldest);
  }

  const session = new MemorySession({ sessionId: conversationId });
  sessions.set(conversationId, session);
  return session;
}
