import type { APIRoute } from "astro";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { slugify } from "../../../utils/slugify";

// Simple JSON-based storage for production
const DATA_DIR = path.join(process.cwd(), "data");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");
const BLOG_DIR = path.join(process.cwd(), "src/content/blog");

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// Load posts from JSON file
async function loadPostsFromJSON() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(POSTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Save posts to JSON file
async function savePostsToJSON(posts: any[]) {
  await ensureDataDir();
  await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// Save post to markdown file (development mode)
async function saveToMarkdown(postData: any) {
  if (!import.meta.env.DEV) return;
  
  try {
    const frontmatter = {
      title: postData.title,
      description: postData.description,
      pubDate: postData.pubDate || new Date().toISOString(),
      heroImage: postData.heroImage || "",
      altText: postData.altText || "",
    };

    const markdownContent = matter.stringify(postData.body || "", frontmatter);
    const filename = `${slugify(postData.title)}.md`;
    const filePath = path.join(BLOG_DIR, filename);
    
    await fs.writeFile(filePath, markdownContent);
  } catch (error) {
    console.warn("Could not save to markdown file:", error);
  }
}

// Delete from markdown file (development mode)
async function deleteFromMarkdown(postId: string) {
  if (!import.meta.env.DEV) return;
  
  try {
    const filename = `${postId}.md`;
    const filePath = path.join(BLOG_DIR, filename);
    await fs.unlink(filePath);
  } catch (error) {
    console.warn("Could not delete markdown file:", error);
  }
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== import.meta.env.SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": request.headers.get("origin") || "*"
      }
    });
  }

  try {
    const url = new URL(request.url, `http://${request.headers.get("host")}`);
    let fileName = url.searchParams.get("fileName");

    if (!fileName) {
      // Return all posts
      const posts = await loadPostsFromJSON();
      return new Response(JSON.stringify({
        posts: posts.map((post: any) => ({
          id: post.id,
          data: {
            title: post.title,
            description: post.description,
            pubDate: new Date(post.pubDate),
            heroImage: post.heroImage || "",
            altText: post.altText || "",
          }
        }))
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Origin": request.headers.get("origin") || "*"
        },
      });
    }

    console.log('Requested fileName:', fileName);
    const slugifiedFileName = slugify(fileName);
    console.log('Slugified fileName:', slugifiedFileName);

    // Find post in JSON storage
    const posts = await loadPostsFromJSON();
    const post = posts.find((p: any) => p.id === slugifiedFileName || p.id === fileName);

    if (post) {
      return new Response(JSON.stringify({
        id: post.id,
        data: {
          title: post.title,
          description: post.description,
          pubDate: new Date(post.pubDate),
          heroImage: post.heroImage || "",
          altText: post.altText || "",
        },
        body: post.body || "",
        rawContent: post.rawContent || ""
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Origin": request.headers.get("origin") || "*"
        },
      });
    }

    return new Response(JSON.stringify({
      error: "Post not found",
      requestedFile: slugifiedFileName
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in GET route:", error);
    return new Response(JSON.stringify({
      error: String(error),
      stack: (error as Error).stack
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== import.meta.env.SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const { fileName, title, description, content, heroImage, altText } = body;

    if (!title || !description) {
      return new Response(JSON.stringify({ error: "Title and description are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const postId = slugify(title);
    const postData = {
      id: postId,
      title,
      description,
      pubDate: new Date().toISOString(),
      heroImage: heroImage || "",
      altText: altText || "",
      body: content || "",
      rawContent: matter.stringify(content || "", {
        title,
        description,
        pubDate: new Date().toISOString(),
        heroImage: heroImage || "",
        altText: altText || "",
      }),
      updatedAt: new Date().toISOString()
    };

    // Load existing posts
    const posts = await loadPostsFromJSON();
    
    // Check if post exists (for updates)
    const existingIndex = posts.findIndex((p: any) => p.id === postId);
    
    if (existingIndex >= 0) {
      // Update existing post
      posts[existingIndex] = postData;
    } else {
      // Add new post
      posts.push(postData);
    }

    // Save to JSON
    await savePostsToJSON(posts);
    
    // Also save to markdown in development
    await saveToMarkdown(postData);

    return new Response(JSON.stringify({ 
      message: "Post saved successfully",
      id: postId,
      mode: import.meta.env.DEV ? "development" : "production"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error saving post:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const PUT: APIRoute = async (context) => {
  return POST(context);
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== import.meta.env.SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const url = new URL(request.url, `http://${request.headers.get("host")}`);
    const fileName = url.searchParams.get("fileName");

    if (!fileName) {
      return new Response(JSON.stringify({ error: "fileName is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const postId = slugify(fileName);
    
    // Load existing posts
    const posts = await loadPostsFromJSON();
    
    // Filter out the post to delete
    const updatedPosts = posts.filter((p: any) => p.id !== postId);
    
    if (posts.length === updatedPosts.length) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Save updated posts
    await savePostsToJSON(updatedPosts);
    
    // Also delete from markdown in development
    await deleteFromMarkdown(postId);

    return new Response(JSON.stringify({ 
      message: "Post deleted successfully",
      id: postId
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error deleting post:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};