import type {
  InputGuardrailFunctionArgs,
  OutputGuardrailFunctionArgs,
} from "@openai/agents";
import type { InputGuardrail, OutputGuardrail } from "@openai/agents";

const MAX_INPUT_TOKENS_ESTIMATE = 2000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type AgentRunInput = InputGuardrailFunctionArgs["input"];

export function flattenAgentInput(input: AgentRunInput): string {
  if (typeof input === "string") return input;
  return JSON.stringify(input);
}

export const meridianInputTokenGuard: InputGuardrail = {
  name: "meridian_input_token_limit",
  runInParallel: false,
  async execute({ input }: InputGuardrailFunctionArgs) {
    const text = flattenAgentInput(input);
    const tokens = estimateTokens(text);
    return {
      tripwireTriggered: tokens > MAX_INPUT_TOKENS_ESTIMATE,
      outputInfo: { tokens, maxTokens: MAX_INPUT_TOKENS_ESTIMATE },
    };
  },
};

const SECRETISH =
  /(?:sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9._-]{20,}|api[_-]?key\s*[:=]\s*[^\s]{8,})/i;

export const meridianOutputSafetyGuard: OutputGuardrail = {
  name: "meridian_output_safety",
  async execute({ agentOutput }: OutputGuardrailFunctionArgs) {
    const text =
      typeof agentOutput === "string" ? agentOutput : String(agentOutput);
    const tripwireTriggered =
      SECRETISH.test(text) ||
      /\b(?:password|pin)\s*[:=]\s*\d{4,}\b/i.test(text);
    return {
      tripwireTriggered,
      outputInfo: { checkedLength: text.length },
    };
  },
};

export const meridianInputGuardrails = [meridianInputTokenGuard];
export const meridianOutputGuardrails = [meridianOutputSafetyGuard];
