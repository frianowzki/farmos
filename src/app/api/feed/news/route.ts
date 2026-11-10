import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { getNews, NEWS_SOURCES } from "@/lib/server/news";

export const maxDuration = 30;

/** Latest headlines from free crypto news RSS feeds (cached 15 min). POST forces a refresh. */
export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  return NextResponse.json({ ...(await getNews(false)), sources: NEWS_SOURCES.map(({ id, name, site, kind }) => ({ id, name, site, kind })) });
}

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  return NextResponse.json({ ...(await getNews(true)), sources: NEWS_SOURCES.map(({ id, name, site, kind }) => ({ id, name, site, kind })) });
}
