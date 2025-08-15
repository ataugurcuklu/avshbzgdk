import type { CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

export interface BlogPostPreview {
  id: string;
  slug: string;
  data: {
    title: string;
    description: string;
    pubDate: Date;
    heroImage: string;
    altText: string;
  };
}
