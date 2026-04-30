import {
  InputGuardrailTripwireTriggered,
  OutputGuardrailTripwireTriggered,
} from "@openai/agents";
import { estimateTokens } from "./guardrails";
import { runSupportChatStream, type ChatMessage } from "./run-support";

export const maxDuration = 60;

function isChatMessage(x: unknown): x is ChatMessage {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    (o.role === "user" || o.role === "assistant") &&
    typeof o.content === "string"
  );
}

function parseBody(body: unknown): {
  conversationId: string;
  messages: ChatMessage[];
} | null {
  if (typeof body !== "object" || body === null) return null;
  const o = body as Record<string, unknown>;
  if (typeof o.conversationId !== "string" || !o.conversationId.trim())
    return null;
  if (!Array.isArray(o.messages) || o.messages.length === 0) return null;
  const messages = o.messages.filter(isChatMessage);
  if (messages.length !== o.messages.length) return null;
  const last = messages[messages.length - 1];
  if (last.role !== "user") return null;
  return { conversationId: o.conversationId.trim(), messages };
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(json);
  if (!parsed) {
    return Response.json(
      {
        error:
          "Expected { conversationId: string, messages: {role, content}[] } with non-empty messages ending in user",
      },
      { status: 400 }
    );
  }

  const { conversationId, messages } = parsed;

  const tokenEstimate = estimateTokens(JSON.stringify(messages));
  if (tokenEstimate > 2000) {
    return Response.json(
      { error: "Input too long (approximate token limit exceeded)" },
      { status: 400 }
    );
  }

  try {
    const stream = await runSupportChatStream(conversationId, messages);
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    if (e instanceof InputGuardrailTripwireTriggered) {
      return Response.json(
        { error: "Input did not pass safety checks" },
        { status: 400 }
      );
    }
    if (e instanceof OutputGuardrailTripwireTriggered) {
      return Response.json(
        { error: "Assistant reply did not pass safety checks" },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : "Chat failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
