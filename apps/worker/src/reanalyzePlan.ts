// 是否对该 signal 做 AI 重分析：
// 1) mock 定型且已挂事件者：升级译文/事实；
// 2) mock 判 ignored 者：AI 可用后重判，追回规则漏报。
export function shouldReanalyze(signal: {
  aiSource: string | null;
  eventId: string | null;
  status?: string | null;
}): boolean {
  if (signal.aiSource !== "mock") return false;
  return signal.eventId !== null || signal.status === "ignored";
}
