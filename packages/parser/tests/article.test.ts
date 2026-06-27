import { describe, expect, it } from "vitest";
import { extractArticle } from "../src/article";

const html = `<!doctype html>
<html>
  <head>
    <meta property="og:image" content="/images/kv.jpg" />
    <meta name="description" content="短い説明" />
  </head>
  <body>
    <main>
      <p>短文</p>
      <p>これはアニメ新情報の記事本文として十分な長さを持つ段落です。正式発表の内容を説明しています。制作会社や公開されたビジュアルについても詳しく触れています。</p>
      <p>放送時期やスタッフ情報など、詳細な補足情報をここに含めています。読者が発表内容を把握できるように、今後の続報予定もあわせて説明しています。</p>
    </main>
  </body>
</html>`;

describe("extractArticle", () => {
  it("提取主图并从正文段落生成文本", () => {
    const article = extractArticle(html, "https://example.com/news/1");

    expect(article.imageUrl).toBe("https://example.com/images/kv.jpg");
    expect(article.text).toContain("正式発表の内容");
    expect(article.text).toContain("詳細な補足情報");
    expect(article.text).not.toContain("短文");
  });
});
