import type { APIRoute } from "astro";
import { getCollection, getEntry } from "astro:content";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { slugify } from "../../../utils/slugify";

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
      // Return all posts if no specific file requested
      const posts = await getCollection("blog");
      return new Response(JSON.stringify({
        posts: posts.map(post => ({
          id: post.id,
          data: post.data
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

    console.log('Original fileName:', fileName);
    const slugifiedFileName = slugify(fileName);
    console.log('Slugified fileName:', slugifiedFileName);

    // Try to get the post from content collection first
    try {
      const post = await getEntry("blog", slugifiedFileName);
      if (post) {
        // For admin editing, we need the raw markdown content
        // This will only work in development mode
        if (import.meta.env.DEV) {
          const blogDir = path.join(process.cwd(), "src/content/blog");
          const markdownFile = `${slugifiedFileName}.md`;
          const contentPath = path.join(blogDir, markdownFile);
          
          try {
            const content = await fs.readFile(contentPath, "utf-8");
            const { data, content: body } = matter(content);
            
            return new Response(JSON.stringify({
              id: post.id,
              data: post.data,
              body,
              rawContent: content
            }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Origin": request.headers.get("origin") || "*"
              },
            });
          } catch (fsError) {
            console.warn("Could not read raw markdown file:", fsError);
          }
        }

        // Return post data without raw content for production
        return new Response(JSON.stringify({
          id: post.id,
          data: post.data,
          notice: "Raw content editing not available in production"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Origin": request.headers.get("origin") || "*"
          },
        });
      }
    } catch (contentError) {
      console.log("Post not found in content collection:", contentError);
    }

    // Fallback to file system approach (development only)
    if (import.meta.env.DEV) {
      try {
        const blogDir = path.join(process.cwd(), "src/content/blog");
        const files = await fs.readdir(blogDir);

        const matchingFile = files.find(file => {
          const fileNameWithoutExt = file.replace('.md', '');
          return fileNameWithoutExt === slugifiedFileName ||
            fileNameWithoutExt === fileName;
        });

        if (matchingFile) {
          const contentPath = path.join(blogDir, matchingFile);
          const content = await fs.readFile(contentPath, "utf-8");
          const { data, content: body } = matter(content);

          return new Response(JSON.stringify({
            id: matchingFile.replace('.md', ''),
            data,
            body,
            rawContent: content
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Credentials": "true",
              "Access-Control-Allow-Origin": request.headers.get("origin") || "*"
            },
          });
        }
      } catch (fsError) {
        console.error("File system fallback failed:", fsError);
      }
    }

    return new Response(JSON.stringify({
      error: "Post not found",
      requestedFile: slugifiedFileName,
      mode: import.meta.env.DEV ? "development" : "production"
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

  if (!import.meta.env.DEV) {
    return new Response(JSON.stringify({ 
      error: "Post creation/editing is only available in development mode. In production, content should be managed through your deployment pipeline." 
    }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const { fileName, content } = body;

    if (!fileName || !content) {
      return new Response(JSON.stringify({ error: "fileName and content are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const blogDir = path.join(process.cwd(), "src/content/blog");
    const filePath = path.join(blogDir, `${slugify(fileName)}.md`);

    await fs.writeFile(filePath, content, "utf-8");

    return new Response(JSON.stringify({ 
      message: "Post saved successfully",
      fileName: `${slugify(fileName)}.md`,
      notice: "You may need to restart the dev server for changes to be reflected in the content collection"
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

  if (!import.meta.env.DEV) {
    return new Response(JSON.stringify({ 
      error: "Post deletion is only available in development mode" 
    }), {
      status: 403,
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

    const blogDir = path.join(process.cwd(), "src/content/blog");
    const filePath = path.join(blogDir, `${slugify(fileName)}.md`);

    await fs.unlink(filePath);

    return new Response(JSON.stringify({ 
      message: "Post deleted successfully",
      notice: "You may need to restart the dev server for changes to be reflected"
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