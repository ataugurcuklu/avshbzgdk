import { getCollection, getEntry } from "astro:content";
import fs from "fs/promises";
import path from "path";
import type { BlogPost, BlogPostPreview } from "../types/blog";

const DATA_DIR = path.join(process.cwd(), "data");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");

// Load posts from JSON file (for admin operations)
async function loadPostsFromJSON(): Promise<any[]> {
  try {
    const data = await fs.readFile(POSTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export async function getAllPosts(): Promise<BlogPost[]> {
  console.log("Fetching all posts...");
  
  try {
    // Try content collection first (for build-time and public pages)
    const posts = await getCollection("blog");
    
    if (posts && posts.length > 0) {
      console.log("Using content collection posts");
      const blogPosts: BlogPost[] = posts.map((post) => ({
        id: post.id,
        collection: "blog",
        data: {
          title: post.data.title,
          description: post.data.description,
          pubDate: post.data.pubDate,
          heroImage: post.data.heroImage || "",
          altText: post.data.altText || "",
        },
      }));

      console.log("Posts fetched count:", blogPosts.length);
      return blogPosts.sort(
        (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
      );
    }
  } catch (error) {
    console.log("Content collection not available, trying JSON storage...");
  }

  // Fallback to JSON storage (for admin operations or when content collection is not available)
  try {
    const jsonPosts = await loadPostsFromJSON();
    console.log("Using JSON storage posts");
    
    const blogPosts: BlogPost[] = jsonPosts.map((post: any) => ({
      id: post.id,
      collection: "blog",
      data: {
        title: post.title,
        description: post.description,
        pubDate: new Date(post.pubDate),
        heroImage: post.heroImage || "",
        altText: post.altText || "",
      },
    }));

    console.log("Posts fetched count from JSON:", blogPosts.length);
    return blogPosts.sort(
      (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
    );
  } catch (error) {
    console.error("Error fetching posts from JSON storage:", error);
    return [];
  }
}

export async function getPostById(id: string): Promise<BlogPost | undefined> {
  try {
    // Try content collection first
    const post = await getEntry("blog", id);
    if (post) {
      return {
        id: post.id,
        collection: "blog",
        data: {
          title: post.data.title,
          description: post.data.description,
          pubDate: post.data.pubDate,
          heroImage: post.data.heroImage || "",
          altText: post.data.altText || "",
        },
      };
    }
  } catch (error) {
    console.log("Content collection not available for single post, trying JSON storage...");
  }

  // Fallback to JSON storage
  try {
    const jsonPosts = await loadPostsFromJSON();
    const post = jsonPosts.find((p: any) => p.id === id);
    
    if (post) {
      return {
        id: post.id,
        collection: "blog",
        data: {
          title: post.title,
          description: post.description,
          pubDate: new Date(post.pubDate),
          heroImage: post.heroImage || "",
          altText: post.altText || "",
        },
      };
    }
  } catch (error) {
    console.error("Error fetching post by id from JSON storage:", error);
  }

  return undefined;
}

export function createPostPreview(post: BlogPost): BlogPostPreview {
  return {
    id: post.id,
    slug: post.id,
    data: {
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      heroImage: post.data.heroImage || "",
      altText: post.data.altText || "",
    },
  };
}