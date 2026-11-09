"use client";
/**
 * Post — PanelUI's social card (native-only upstream), rebuilt for the web: author, body, media and the
 * counts underneath. Used for the connected X account's timeline. Read-only: counts link out to X.
 */
import { BadgeCheck, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export type PostData = {
  id: string;
  text: string;
  createdAt: string | null;
  url: string;
  author: { name: string; username: string; image: string | null; verified: boolean } | null;
  metrics: { like_count: number; retweet_count: number; reply_count: number } | null;
  media: { type: string; url: string | null }[];
};

const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
function ago(iso: string | null) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Post({ post, className }: { post: PostData; className?: string }) {
  const a = post.author;
  return (
    <motion.article layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("rounded-xl border border-line bg-panel p-4", className)}>
      <header className="flex items-center gap-2.5">
        {a?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image} alt="" width={36} height={36} className="h-9 w-9 rounded-full bg-hover object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="h-9 w-9 rounded-full bg-hover" />
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1 truncate text-[13.5px] font-medium text-ink">
            {a?.name ?? "Unknown"} {a?.verified && <BadgeCheck className="h-3.5 w-3.5 text-accent" aria-label="Verified" />}
          </div>
          <div className="truncate text-[12.5px] text-muted">@{a?.username ?? "unknown"} · {ago(post.createdAt)}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/x.webp" alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-[5px]" />
      </header>
      <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-2">{post.text}</p>
      {post.media.length > 0 && post.media[0].url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.media[0].url} alt="" className="mt-3 max-h-80 w-full rounded-lg border border-line object-cover" referrerPolicy="no-referrer" loading="lazy" />
      )}
      {post.metrics && (
        <footer className="mt-3 flex items-center gap-5 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> {short(post.metrics.reply_count)}</span>
          <span className="inline-flex items-center gap-1.5"><Repeat2 className="h-3.5 w-3.5" /> {short(post.metrics.retweet_count)}</span>
          <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" /> {short(post.metrics.like_count)}</span>
          <a href={post.url} target="_blank" rel="noreferrer" className="ml-auto text-ink-2 hover:text-accent">Open on X</a>
        </footer>
      )}
    </motion.article>
  );
}
