import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import type { BlogPost, BlogPostPreview } from "../types/blog";

const BLOG_DIR = path.join(process.cwd(), "src/content/blog");

export async function getAllPosts(): Promise<BlogPost[]> {
  console.log("Fetching all posts from filesystem...");
  const files = await fs.readdir(BLOG_DIR);
  const posts: BlogPost[] = [];

  for (const file of files) {
    if (file.endsWith(".md") || file.endsWith(".mdx")) {
      const filePath = path.join(BLOG_DIR, file);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const { data } = matter(fileContent);

      posts.push({
        id: data.title.replace(/\s+/g, "-").toLowerCase(),
        collection: "blog",
        data: {
          title: data.title,
          description: data.description,
          pubDate: new Date(data.pubDate),
          heroImage: data.heroImage || "",
          altText: data.altText || "",
        },
      });
    }
  }

  console.log("Posts fetched count:", posts.length);
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
}

export async function getPostById(id: string): Promise<BlogPost | undefined> {
  const posts = await getAllPosts();
  return posts.find((post) => post.id === id);
}

export function createPostPreview(post: BlogPost): BlogPostPreview {
  return {
    id: post.id,
    slug: post.id,
    data: {
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      heroImage: post.data.heroImage,
      altText: post.data.altText,
    },
  };
}