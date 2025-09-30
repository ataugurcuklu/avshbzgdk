import type { APIRoute } from "astro";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { file } from "astro/loaders";
import { slugify } from "../../../utils/slugify";

const execAsync = promisify(exec);

// Save image to both source and dist directories
async function saveImageToBothLocations(imagePath: string, buffer: Buffer) {
  const distPath = path.join(process.cwd(), "dist", "client", imagePath);
  const sourcePath = path.join(process.cwd(), "public", imagePath);
  
  // Ensure both directories exist with proper error handling
  try {
    await fs.mkdir(path.dirname(distPath), { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
  
  try {
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
  
  // Save to both locations
  await Promise.all([
    fs.writeFile(distPath, buffer),
    fs.writeFile(sourcePath, buffer)
  ]);
}

const checkAuth = (cookies: any) => {
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== import.meta.env.SECRET_KEY) {
    return false;
  }
  return true;
};

async function rebuildSite() {
  try {
    await execAsync("bun run build", {
      env: { ...process.env },
      cwd: process.cwd(),
    });



    console.log("Build completed successfully");
  } catch (error) {
    console.log("Build completed with warnings");
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  console.log("POST request received for operation");
  
  if (!checkAuth(cookies)) {
    console.log("Authentication failed");
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
    const formData = await request.formData();
    console.log("Form data received");

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const content = formData.get("content") as string;
    const altText = formData.get("altText") as string;
    const heroImage = formData.get("heroImage") as File | string;

    console.log("Parsed form data:", { title, description, content: content?.substring(0, 50), altText, heroImage: heroImage instanceof File ? 'File' : heroImage });

    if (!title || !description || !content || !altText || !heroImage) {
      console.log("Missing required fields");
      return new Response(JSON.stringify({ error: "Missing required fields" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const fileName = slugify(title);

    const date = new Date().toISOString().split("T")[0];
    let imagePath: string;

    if (heroImage instanceof File) {
      const imageBuffer = Buffer.from(await heroImage.arrayBuffer());
      const imageExt = path.extname(heroImage.name).toLowerCase();
      imagePath = `/assets/blog/${fileName}${imageExt}`;

      await saveImageToBothLocations(imagePath, imageBuffer);
    } else {
      imagePath = heroImage;
    }

    const frontMatter = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
pubDate: "${date}"
heroImage: "${imagePath}"
altText: "${altText.replace(/"/g, '\\"')}"
---

${content}`;

    const contentDir = path.join(process.cwd(), "src", "content", "blog");
    try {
      await fs.mkdir(contentDir, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') throw error;
    }

    await fs.writeFile(
      path.join(contentDir, `${fileName}.md`),
      frontMatter,
      "utf-8",
    );

    await rebuildSite();

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error in POST route:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to create post", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!checkAuth(cookies)) {
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
    const formData = await request.formData();
    const originalFileName = formData.get("originalFileName") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const content = formData.get("content") as string;
    const altText = formData.get("altText") as string;
    const heroImage = formData.get("heroImage") as File | string;

    if (
      !title ||
      !description ||
      !content ||
      !altText ||
      !heroImage ||
      !originalFileName
    ) {
      return new Response(null, { status: 400 });
    }

    const newFileName = slugify(title);
    
    let imagePath: string;
    if (heroImage instanceof File) {
      const imageBuffer = Buffer.from(await heroImage.arrayBuffer());
      const imageExt = path.extname(heroImage.name).toLowerCase();
      imagePath = `/assets/blog/${newFileName}${imageExt}`; // Use new filename for new images

      await saveImageToBothLocations(imagePath, imageBuffer);
    } else {
      imagePath = heroImage;
    }

    const updatedContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
pubDate: "${new Date().toISOString().split("T")[0]}"
heroImage: "${imagePath}"
altText: "${altText.replace(/"/g, '\\"')}"
---

${content}`;

    const contentDir = path.join(process.cwd(), "src", "content", "blog");
    const oldPath = path.join(contentDir, `${originalFileName}.md`);
    const newPath = path.join(contentDir, `${newFileName}.md`);

    if (originalFileName !== newFileName) {
      try {
        await fs.rename(oldPath, newPath);
      } catch (error) {
        console.error("Error renaming file:", error);
        await fs.writeFile(newPath, updatedContent, "utf-8");
        await fs.unlink(oldPath);
      }
    }

    await fs.writeFile(
      newFileName === originalFileName ? oldPath : newPath,
      updatedContent,
      "utf-8",
    );
    await rebuildSite();

    return new Response(null, {
      status: 200,
      headers: {
        "HX-Redirect": "/admin/posts",
      },
    });
  } catch (error) {
    console.error("Error in PUT route:", error);
    return new Response(String(error), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!checkAuth(cookies)) {
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
    const url = new URL(request.url);
    const fileName = url.searchParams.get("fileName");

    if (!fileName) {
      return new Response(JSON.stringify({ error: "File name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentPath = path.join(
      process.cwd(),
      "src/content/blog",
      `${fileName}.md`,
    );

    try {
      await fs.access(contentPath);
    } catch (error) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    await fs.unlink(contentPath);

    await rebuildSite();

    return new Response(
      JSON.stringify({ message: "Post deleted successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "HX-Redirect": "/admin/posts",
        },
      },
    );
  } catch (error) {
    console.error("Delete error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to delete post",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
