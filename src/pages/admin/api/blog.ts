import type { APIRoute } from "astro";
import { statements, createPostSlug, createPostSlugForUpdate, type BlogPostData } from "../../../lib/database";

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
    const slug = url.searchParams.get("slug");

    if (!slug) {
      // Return all posts
      const posts = statements.getAllPosts.all() as BlogPostData[];
      return new Response(JSON.stringify({
        posts: posts.map(post => ({
          id: post.id,
          slug: post.slug,
          title: post.title,
          description: post.description,
          pubDate: post.pub_date,
          heroImage: post.hero_image,
          altText: post.alt_text,
          updatedDate: post.updated_date
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

    // Get specific post by slug
    const post = statements.getPostBySlug.get(slug) as BlogPostData | null;
    
    if (!post) {
      return new Response(JSON.stringify({
        error: "Post not found",
        requestedSlug: slug
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      id: post.id,
      slug: post.slug,
      title: post.title,
      description: post.description,
      content: post.content,
      heroImage: post.hero_image,
      altText: post.alt_text,
      pubDate: post.pub_date,
      updatedDate: post.updated_date
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": request.headers.get("origin") || "*"
      },
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
    const { title, description, content, heroImage, altText } = body;

    if (!title || !description || !content) {
      return new Response(JSON.stringify({ error: "Title, description, and content are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const slug = createPostSlug(title);
    const now = new Date().toISOString();

    const result = statements.insertPost.run(
      slug,
      title,
      description,
      content,
      heroImage || "",
      altText || "",
      now,
      now
    );

    return new Response(JSON.stringify({ 
      message: "Post created successfully",
      slug: slug,
      changes: result.changes
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error creating post:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== import.meta.env.SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const { slug, title, description, content, heroImage, altText } = body;

    if (!slug || !title || !description || !content) {
      return new Response(JSON.stringify({ error: "Slug, title, description, and content are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const now = new Date().toISOString();
    
    // Generate new slug based on title
    const newSlug = createPostSlugForUpdate(title, slug);
    
    // Use the appropriate update statement based on whether slug changed
    const result = statements.updatePostWithSlug.run(
      newSlug,
      title,
      description,
      content,
      heroImage || "",
      altText || "",
      now,
      slug
    );

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ 
      message: "Post updated successfully",
      slug: newSlug,
      oldSlug: slug,
      slugChanged: newSlug !== slug,
      changes: result.changes
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error updating post:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
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
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "Post slug is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = statements.deletePost.run(slug);

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ 
      message: "Post deleted successfully",
      slug: slug,
      changes: result.changes
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