import {
  addTraceProcessor,
  BatchTraceProcessor,
  ConsoleSpanExporter,
  Runner,
  startTraceExportLoop,
} from "@openai/agents";

let devTracingBootstrapped = false;

function ensureDevConsoleTracing() {
  if (process.env.NODE_ENV !== "development" || devTracingBootstrapped) return;
  devTracingBootstrapped = true;
  const processor = new BatchTraceProcessor(new ConsoleSpanExporter());
  processor.start();
  addTraceProcessor(processor);
  startTraceExportLoop();
}

export function createChatRunner(conversationId: string): Runner {
  ensureDevConsoleTracing();

  const tracingDisabled = process.env.AGENTS_TRACING_DISABLED === "true";
  const traceIncludeSensitiveData =
    process.env.AGENTS_TRACE_INCLUDE_SENSITIVE === "true";

  const tracingApiKey = process.env.OPENAI_TRACE_API_KEY;

  return new Runner({
    workflowName: "meridian_support_chat",
    groupId: conversationId,
    tracingDisabled,
    traceIncludeSensitiveData,
    ...(tracingApiKey ? { tracing: { apiKey: tracingApiKey } } : {}),
  });
}
