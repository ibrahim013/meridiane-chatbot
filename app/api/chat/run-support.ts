import type { Readable } from "node:stream";
import {
  Agent,
  assistant,
  MCPServerStreamableHttp,
  user,
  type AgentInputItem,
} from "@openai/agents";
import {
  meridianInputGuardrails,
  meridianOutputGuardrails,
} from "./guardrails";
import { getMemorySession } from "./session-store";
import { createChatRunner } from "./tracing";

const SUPPORT_INSTRUCTIONS = `You are Meridian Electronics support. Help with monitors, keyboards, printers, networking, and accessories.
Use MCP tools: list_products, search_products, get_product for catalog; verify_customer_pin before sharing account details or placing orders; get_customer, list_orders, get_order, create_order as appropriate.
Get the customer_id from the user's email and PIN Response from verify_customer_pin.
Be concise and accurate. If you lack a customer_id, ask the user to verify with email and PIN first when needed. If you are not able to proceed, ask the user to contact support.`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

function messagesToItems(messages: ChatMessage[]): AgentInputItem[] {
  return messages.map((m) =>
    m.role === "user" ? user(m.content) : assistant(m.content)
  );
}

export async function runSupportChatStream(
  conversationId: string,
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  
  const mcpUrl = process.env.MCP_SERVER_URL;

  const mcpServer = new MCPServerStreamableHttp({
    name: "order-mcp",
    url: mcpUrl ?? "",
  });

  await mcpServer.connect();

  const agent = new Agent({
    name: "Meridian Support",
    instructions: SUPPORT_INSTRUCTIONS,
    model: "gpt-4o-mini",
    mcpServers: [mcpServer],
    inputGuardrails: meridianInputGuardrails,
    outputGuardrails: meridianOutputGuardrails,
  });

  const runner = createChatRunner(conversationId);
  const session = getMemorySession(conversationId);

  const prior = await session.getItems();
  if (prior.length === 0 && messages.length > 1) {
    await session.addItems(messagesToItems(messages.slice(0, -1)));
  }

  const last = messages[messages.length - 1];
  const delta: AgentInputItem[] = [user(last.content)];

  const result = await runner.run(agent, delta, {
    session,
    stream: true,
    maxTurns: 40,
  });

  const textStream = result.toTextStream({
    compatibleWithNodeStreams: true,
  }) as Readable;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          const s = typeof chunk === "string" ? chunk : String(chunk);
          controller.enqueue(encoder.encode(s));
        }
      } finally {
        try {
          await result.completed;
        } catch {
          /* errors may already be surfaced */
        }
        await mcpServer.close();
        controller.close();
      }
    },
    cancel() {
      void result.completed.catch(() => {});
      void mcpServer.close();
    },
  });
}
