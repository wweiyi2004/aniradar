export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

// 读取 AI 配置；无 API key 时返回 null（调用方回退到规则 mock）。
// 默认 DeepSeek（OpenAI 兼容，国内直连）。
export function getAiConfig(): AiConfig | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.deepseek.com").replace(
    /\/+$/,
    "",
  );
  const model = process.env.AI_MODEL?.trim() || "deepseek-chat";
  return { apiKey, baseUrl, model };
}

// 是否配置了可用的 AI（有 API key）。供调度判断要不要尝试重分析。
export function isAiConfigured(): boolean {
  return getAiConfig() !== null;
}

// 调用 OpenAI 兼容的 /chat/completions，要求返回 JSON，返回 content 字符串。
export async function chatJson(
  cfg: AiConfig,
  system: string,
  user: string,
  timeoutMs = 45_000,
  maxTokens = 4096,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`AI HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string | null }[];
    };
    const content = data.choices?.[0]?.message?.content;
    // 推理模型(如 deepseek-v4-flash)可能把 max_tokens 全部耗在 reasoning 上,
    // content 为空且 finish_reason=length。抛出可识别错误,让上层按瞬时故障重试
    // 而不是静默降级 mock(实测偶发思考链暴涨,900 上限不够用)。
    if (!content) {
      const finish = data.choices?.[0]?.finish_reason;
      throw new Error(
        finish === "length" ? "AI truncated by max_tokens" : "AI empty response",
      );
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}
