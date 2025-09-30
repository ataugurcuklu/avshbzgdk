import { statements, type BlogPostData } from "../lib/database";
import type { BlogPost, BlogPostPreview } from "../types/blog";

export async function getAllPosts(): Promise<BlogPost[]> {
  console.log("Fetching all posts from SQLite database...");
  
  try {
    const posts = statements.getAllPosts.all() as BlogPostData[];
    
    const blogPosts: BlogPost[] = posts.map((post) => ({
      id: post.slug, // Use slug as the public ID
      collection: "blog",
      data: {
        title: post.title,
        description: post.description,
        pubDate: new Date(post.pub_date),
        heroImage: post.hero_image || "",
        altText: post.alt_text || "",
      },
    }));

    console.log("Posts fetched count:", blogPosts.length);
    return blogPosts;
  } catch (error) {
    console.error("Error fetching posts from database:", error);
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  try {
    const post = statements.getPostBySlug.get(slug) as BlogPostData | null;
    if (!post) return undefined;

    return {
      id: post.slug, // Use slug as the public ID
      collection: "blog",
      data: {
        title: post.title,
        description: post.description,
        pubDate: new Date(post.pub_date),
        heroImage: post.hero_image || "",
        altText: post.alt_text || "",
      },
    };
  } catch (error) {
    console.error("Error fetching post by slug:", error);
    return undefined;
  }
}

export async function getPostById(id: string): Promise<BlogPost | undefined> {
  // For backward compatibility, this is now the same as getPostBySlug
  return getPostBySlug(id);
}

export async function getPostContent(slug: string): Promise<string> {
  try {
    const post = statements.getPostBySlug.get(slug) as BlogPostData | null;
    return post?.content || "";
  } catch (error) {
    console.error("Error fetching post content:", error);
    return "";
  }
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