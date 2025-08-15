import type { APIRoute } from "astro";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { slugify } from "../../../utils/slugify";

export const GET: APIRoute = async ({ request, cookies }) => {
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== "authenticated") {
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
      return new Response(JSON.stringify({ error: "File name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log('Original fileName:', fileName);
    const slugifiedFileName = slugify(fileName);
    console.log('Slugified fileName:', slugifiedFileName);

    // Get all files in the blog directory
    const blogDir = path.join(process.cwd(), "src/content/blog");
    const files = await fs.readdir(blogDir);

    // Find the matching file
    const matchingFile = files.find(file => {
      const fileNameWithoutExt = file.replace('.md', '');
      return fileNameWithoutExt === slugifiedFileName ||
        fileNameWithoutExt === fileName;
    });

    if (!matchingFile) {
      return new Response(JSON.stringify({
        error: "File not found",
        requestedFile: slugifiedFileName,
        availableFiles: files
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentPath = path.join(blogDir, matchingFile);
    const content = await fs.readFile(contentPath, "utf-8");
    const { data, content: body } = matter(content);

    return new Response(JSON.stringify({
      id: matchingFile.replace('.md', ''),
      data,
      body
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