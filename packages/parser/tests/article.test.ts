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

const P = "この段落は二十文字を超える本文テキストです、テスト用の内容。";

function page(bodyInner: string, head = ""): string {
  return `<!doctype html><html><head>${head}</head><body>${bodyInner}</body></html>`;
}

describe("extractArticle · 内嵌 YouTube 提取", () => {
  it("article 内 iframe 嵌入 → videoUrl", () => {
    const doc = page(
      `<article><p>${P}</p><iframe src="https://www.youtube.com/embed/AbC123xyz_-?rel=0"></iframe></article>`,
    );
    expect(extractArticle(doc, "https://example.com/news/1").videoUrl).toBe(
      "https://www.youtube.com/watch?v=AbC123xyz_-",
    );
  });
  it("nocookie 域 iframe 同样识别", () => {
    const doc = page(
      `<article><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe><p>${P}</p></article>`,
    );
    expect(extractArticle(doc, "https://example.com/").videoUrl).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });
  it("article 内正文链接指向 YouTube → videoUrl", () => {
    const doc = page(
      `<article><p>${P}</p><a href="https://youtu.be/dQw4w9WgXcQ">PVを見る</a></article>`,
    );
    expect(extractArticle(doc, "https://example.com/").videoUrl).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });
  it("无 article/main 容器时不取链接（避免页脚频道链接误报），但 iframe 仍可取", () => {
    const docLink = page(`<p>${P}</p><a href="https://youtu.be/dQw4w9WgXcQ">ch</a>`);
    expect(extractArticle(docLink, "https://example.com/").videoUrl).toBeUndefined();
    const docIframe = page(
      `<p>${P}</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>`,
    );
    expect(extractArticle(docIframe, "https://example.com/").videoUrl).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });
  it("无视频时 videoUrl 为 undefined", () => {
    const doc = page(`<article><p>${P}</p></article>`);
    expect(extractArticle(doc, "https://example.com/").videoUrl).toBeUndefined();
  });
});
