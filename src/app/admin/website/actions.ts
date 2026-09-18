"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { sanitizeCmsHtml, slugify } from "@/lib/website/sanitize";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function setReleaseWebsiteAction(input: {
  releaseId: string;
  published?: boolean;
  featured?: boolean;
  slug?: string;
  blurb?: string;
  sortOrder?: number;
  playbackEnabled?: boolean;
  embedSpotify?: string;
  embedApple?: string;
  embedYoutube?: string;
  coverUrl?: string | null;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:releases");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_release_website", {
    p_release_id: input.releaseId,
    p_published: input.published ?? null,
    p_featured: input.featured ?? null,
    p_slug: input.slug != null ? slugify(input.slug) : null,
    p_blurb: input.blurb ?? null,
    p_sort_order: input.sortOrder ?? null,
    p_playback_enabled: input.playbackEnabled ?? null,
    p_embed_spotify: input.embedSpotify ?? null,
    p_embed_apple: input.embedApple ?? null,
    p_embed_youtube: input.embedYoutube ?? null,
  });
  if (error) return { ok: false, error: error.message };
  if (input.coverUrl !== undefined) {
    const { error: coverError } = await supabase
      .from("releases")
      .update({
        website_cover_override_url: input.coverUrl?.trim()
          ? input.coverUrl.trim()
          : null,
      })
      .eq("id", input.releaseId);
    if (coverError) return { ok: false, error: coverError.message };
  }
  revalidatePath("/admin/website");
  revalidatePath("/music");
  revalidatePath("/");
  revalidatePath("/release", "layout");
  return { ok: true, data };
}

export async function setArtistWebsiteAction(input: {
  artistProfileId: string;
  published?: boolean;
  featured?: boolean;
  slug?: string;
  tagline?: string;
  bioHtml?: string;
  sortOrder?: number;
  artistName?: string;
  genres?: string[];
  country?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  socialLinks?: Record<string, string> | null;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:artists");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_artist_website", {
    p_artist_profile_id: input.artistProfileId,
    p_published: input.published ?? null,
    p_featured: input.featured ?? null,
    p_slug: input.slug != null ? slugify(input.slug) : null,
    p_tagline: input.tagline ?? null,
    p_bio_html: input.bioHtml != null ? sanitizeCmsHtml(input.bioHtml) : null,
    p_bio_json: null,
    p_social_links: input.socialLinks ?? null,
    p_sort_order: input.sortOrder ?? null,
    p_artist_name: input.artistName ?? null,
    p_genres: input.genres ?? null,
    p_country: input.country === undefined ? null : input.country,
    p_avatar_url: input.avatarUrl === undefined ? null : input.avatarUrl,
    p_cover_url: input.coverUrl === undefined ? null : input.coverUrl,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/website");
  revalidatePath(`/admin/artists/${input.artistProfileId}`);
  revalidatePath("/music");
  revalidatePath("/");
  return { ok: true, data };
}

export async function upsertHomepageSettingsAction(
  value: Record<string, unknown>
): Promise<ActionResult> {
  await RequireAdminPermission("admin:settings");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_website_setting", {
    p_key: "homepage",
    p_value: value,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/website");
  revalidatePath("/");
  return { ok: true, data };
}


export async function upsertFooterSettingsAction(
  value: Record<string, unknown>
): Promise<ActionResult> {
  await RequireAdminPermission("admin:settings");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_website_setting", {
    p_key: "footer",
    p_value: value,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/pages");
  revalidatePath("/admin/website");
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function upsertWebsiteVideoAction(input: {
  id?: string;
  title?: string;
  url?: string;
  thumbnailUrl?: string | null;
  artistId?: string | null;
  releaseId?: string | null;
  trackId?: string | null;
  published?: boolean;
  sortOrder?: number;
  delete?: boolean;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:settings");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_website_video", {
    p_id: input.id ?? null,
    p_title: input.title ?? null,
    p_url: input.url ?? null,
    p_thumbnail_url: input.thumbnailUrl === undefined ? null : input.thumbnailUrl,
    p_artist_id: input.artistId === undefined ? null : input.artistId,
    p_release_id: input.releaseId === undefined ? null : input.releaseId,
    p_track_id: input.trackId === undefined ? null : input.trackId,
    p_published: input.published ?? null,
    p_sort_order: input.sortOrder ?? null,
    p_delete: input.delete ?? false,
  });
  if (error) return { ok: false, error: error.message };

  // The legacy RPC intentionally treats NULL associations as "keep existing".
  // Apply explicit nullable edits here so admins can actually clear fields.
  if (input.id) {
    const explicit: Record<string, unknown> = {};
    if (input.thumbnailUrl !== undefined) {
      explicit.thumbnail_url = input.thumbnailUrl?.trim() || null;
    }
    if (input.artistId !== undefined) explicit.artist_id = input.artistId || null;
    if (input.releaseId !== undefined) explicit.release_id = input.releaseId || null;
    if (input.trackId !== undefined) explicit.track_id = input.trackId || null;
    if (Object.keys(explicit).length) {
      explicit.updated_at = new Date().toISOString();
      const { error: explicitError } = await supabase
        .from("website_videos")
        .update(explicit)
        .eq("id", input.id);
      if (explicitError) return { ok: false, error: explicitError.message };
    }
  }

  revalidatePath("/admin/videos");
  revalidatePath("/admin/website");
  revalidatePath("/");
  revalidatePath("/music");
  revalidatePath("/artist", "layout");
  revalidatePath("/release", "layout");
  return { ok: true, data };
}

export async function upsertPartnerAction(input: {
  id?: string;
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:settings");
  const supabase = await createClient();
  const row = {
    name: input.name.trim(),
    logo_url: input.logoUrl?.trim() || null,
    website_url: input.websiteUrl?.trim() || null,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
    slug: slugify(input.name),
  };
  if (input.id) {
    const { error } = await supabase.from("website_partners").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("website_partners").insert(row);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin/partners");
  revalidatePath("/admin/website");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePartnerAction(id: string): Promise<ActionResult> {
  await RequireAdminPermission("admin:settings");
  const supabase = await createClient();
  const { error } = await supabase.from("website_partners").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/partners");
  revalidatePath("/admin/website");
  revalidatePath("/");
  return { ok: true };
}

export async function upsertBlogPostAction(input: {
  id?: string;
  title: string;
  slug?: string;
  excerpt?: string;
  bodyHtml: string;
  status: "draft" | "published" | "archived";
  coverImageUrl?: string;
  tags?: string[];
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:settings");
  const supabase = await createClient();
  const slug = slugify(input.slug || input.title);
  const body = sanitizeCmsHtml(input.bodyHtml);
  const row: Record<string, unknown> = {
    title: input.title.trim(),
    slug,
    excerpt: input.excerpt?.trim() || null,
    body_html: body,
    status: input.status,
    cover_image_url: input.coverImageUrl?.trim() || null,
    tags: input.tags ?? [],
    published_at:
      input.status === "published" ? new Date().toISOString() : null,
  };
  if (input.id) {
    const { error } = await supabase.from("blog_posts").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("blog_posts").insert(row);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/admin/blog");
  revalidatePath("/admin/website");
  revalidatePath("/blog");
  revalidatePath("/");
  return { ok: true };
}

export async function upsertCmsPageAction(input: {
  id: string;
  title: string;
  bodyHtml: string;
  status: "draft" | "published" | "archived";
  seoTitle?: string;
  seoDescription?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:settings");
  const supabase = await createClient();
  const { error } = await supabase
    .from("cms_pages")
    .update({
      title: input.title.trim(),
      body_html: sanitizeCmsHtml(input.bodyHtml),
      status: input.status,
      seo_title: input.seoTitle?.trim() || null,
      seo_description: input.seoDescription?.trim() || null,
      published_at:
        input.status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/pages");
  revalidatePath("/admin/website");
  revalidatePath("/privacy");
  revalidatePath("/terms");
  revalidatePath("/cookies");
  revalidatePath("/refund-policy");
  revalidatePath("/contact");
  revalidatePath("/pricing");
  revalidatePath("/pages", "layout");
  return { ok: true };
}
