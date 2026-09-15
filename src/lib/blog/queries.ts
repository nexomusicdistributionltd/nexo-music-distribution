import "server-only";

import { createClient } from "@/lib/supabase/server";

export type BlogPostListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  tags: string[];
};

export async function listPublishedPosts(limit = 30): Promise<BlogPostListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_image_url, published_at, tags")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(Math.min(100, limit));
  if (error) {
    console.error("listPublishedPosts", error.message);
    return [];
  }
  return (data ?? []) as BlogPostListItem[];
}

export async function getPublishedPostBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAllPostsAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, status, published_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getPostAdmin(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Publish filter helper for tests. */
export function filterPublishedPosts<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((r) => r.status === "published");
}
