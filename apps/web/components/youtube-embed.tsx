// 内联 YouTube 播放器（16:9 响应式，nocookie 域降低跟踪）。
export function YouTubeEmbed({ id, title }: { id: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-md border bg-black">
      <div className="relative aspect-video">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title={title ?? "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  );
}
