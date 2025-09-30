import type { APIRoute } from "astro";
import fs from "fs/promises";
import path from "path";

interface ImageInfo {
  path: string;
  name: string;
  size: number;
  lastModified: number;
}

// Save image to both source and dist directories
async function saveImageToBothLocations(fileName: string, buffer: Buffer) {
  const distPath = path.join(process.cwd(), "dist", "client", "assets", "blog", fileName);
  const sourcePath = path.join(process.cwd(), "public", "assets", "blog", fileName);
  
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

// Delete image from both source and dist directories
async function deleteImageFromBothLocations(imagePath: string) {
  const distPath = path.join(process.cwd(), "dist", "client", imagePath);
  const sourcePath = path.join(process.cwd(), "public", imagePath);
  
  await Promise.allSettled([
    fs.unlink(distPath),
    fs.unlink(sourcePath)
  ]);
}

export const GET: APIRoute = async ({ request, cookies }) => {
  console.log("GET request received");
  console.log("Auth cookie:", cookies.get("auth")?.value);

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
    const blogImagesDir = path.join(process.cwd(), "dist", "client", "assets", "blog");

    try {
      await fs.access(blogImagesDir);
    } catch {
      await fs.mkdir(blogImagesDir, { recursive: true });
      return new Response(JSON.stringify([]), {
        headers: {
          "Content-Type": "application/json",
          "HX-Redirect": "/admin/media",
        },
      });
    }

    const files = await fs.readdir(blogImagesDir);
    const imageFiles = await Promise.all(
      files
        .filter((file) => /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(file))
        .map(async (file) => {
          const filePath = path.join(blogImagesDir, file);
          const stats = await fs.stat(filePath);
          const name = file.replace(/\.[^/.]+$/, "");
          return {
            path: `/assets/blog/${file}`,
            name: name,
            size: stats.size,
            lastModified: stats.mtimeMs,
          } as ImageInfo;
        }),
    );

    const sortedImages = imageFiles.sort(
      (a, b) => b.lastModified - a.lastModified,
    );

    return new Response(JSON.stringify(sortedImages), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error in images API:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch images",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "HX-Redirect": "/admin/media",
        },
      },
    );
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
    const url = new URL(request.url);
    const imagePath = url.searchParams.get("imagePath");

    if (!imagePath) {
      return new Response(JSON.stringify({ error: "Image path is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "HX-Redirect": "/admin/media",
        },
      });
    }

    const fullPath = path.join(process.cwd(), "dist", "client", imagePath);
    const blogImagesDir = path.join(process.cwd(), "dist", "client", "assets", "blog");

    if (!fullPath.startsWith(blogImagesDir)) {
      return new Response(JSON.stringify({ error: "Invalid image path" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "HX-Redirect": "/admin/media",
        },
      });
    }

    await deleteImageFromBothLocations(imagePath);

    return new Response(
      JSON.stringify({ message: "Image deleted successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "HX-Redirect": "/admin/media",
        },
      },
    );
  } catch (error) {
    console.error("Error deleting image:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to delete image",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
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
    const formData = await request.formData();
    
    // Check for single hero image upload
    const heroImage = formData.get("heroImage") as File;
    // Check for multiple images upload
    const images = formData.getAll("images") as File[];
    
    const imagesToProcess: File[] = [];
    
    if (heroImage && heroImage.type.startsWith("image/")) {
      imagesToProcess.push(heroImage);
    }
    
    if (images && images.length > 0) {
      imagesToProcess.push(...images.filter(img => img.type.startsWith("image/")));
    }

    if (imagesToProcess.length === 0) {
      return new Response(JSON.stringify({ error: "No valid images provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const uploadedImages: ImageInfo[] = [];

    for (const image of imagesToProcess) {
      const fileName = `${Date.now()}-${image.name}`;

      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await saveImageToBothLocations(fileName, buffer);

      uploadedImages.push({
        path: `/assets/blog/${fileName}`,
        name: fileName,
        size: buffer.length,
        lastModified: Date.now(),
      });
    }

    // For single hero image uploads, return the first (and only) image path
    if (heroImage && uploadedImages.length === 1) {
      return new Response(
        JSON.stringify({
          message: "Hero image uploaded successfully",
          path: uploadedImages[0].path,
          image: uploadedImages[0]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // For multiple image uploads, return all images
    return new Response(
      JSON.stringify({
        message: "Images uploaded successfully",
        images: uploadedImages,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "HX-Redirect": "/admin/media",
        },
      },
    );
  } catch (error) {
    console.error("Error uploading images:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to upload images",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
