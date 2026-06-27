// 是否对该 signal 做 AI 重分析：仅 mock 定型且已挂事件者。
export function shouldReanalyze(signal: { aiSource: string | null; eventId: string | null }): boolean {
  return signal.aiSource === "mock" && signal.eventId !== null;
}
