// 高精度负向预过滤：标题明显属于招聘/公司 HR 类（几乎不可能是动漫情报）时返回 true。
// 用于在调用 AI 前直接判为非情报，省调用且更正确。
// 刻意保守：只列足够具体的招聘短语，宁可漏过也不误杀真情报。
// （注意不要用裸 "採用"——会误伤"主題歌に採用"等真情报。）
const NON_NEWS_KEYWORDS = [
  "新卒採用",
  "中途採用",
  "採用情報",
  "求人情報",
  "求人募集",
  "インターンシップ",
  "会社説明会",
  "オープンカンパニー",
  "エントリー受付",
  "エントリー締切",
];

export function looksNonNews(title: string): boolean {
  const t = title ?? "";
  return NON_NEWS_KEYWORDS.some((k) => t.includes(k));
}
