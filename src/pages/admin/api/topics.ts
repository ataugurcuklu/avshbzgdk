import type { APIRoute } from "astro";
import { getAllTopics, createTopic, updateTopic, deleteTopic } from "../../../lib/database";

export const GET: APIRoute = async ({ cookies }) => {
  // Check authentication
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== import.meta.env.SECRET_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const topics = getAllTopics();
    return new Response(JSON.stringify(topics), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error fetching topics:", error);
    return new Response("Internal server error", { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  // Check authentication
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== import.meta.env.SECRET_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const data = await request.json();
    const { name, description, color } = data;

    if (!name || !color) {
      return new Response("Name and color are required", { status: 400 });
    }

    // Check if name already exists
    const existingTopics = getAllTopics();
    const existing = existingTopics.find(topic => topic.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      return new Response("A topic with this name already exists", { status: 400 });
    }

    const id = createTopic(name, description || '', color);

    return new Response(JSON.stringify({ 
      success: true, 
      id
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error creating topic:", error);
    return new Response("Internal server error", { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  // Check authentication
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== import.meta.env.SECRET_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const data = await request.json();
    const { id, name, description, color } = data;

    if (!id || !name || !color) {
      return new Response("ID, name and color are required", { status: 400 });
    }

    const topicId = parseInt(id);
    
    // Check if name already exists for other topics
    const existingTopics = getAllTopics();
    const existing = existingTopics.find(topic => 
      topic.name.toLowerCase() === name.toLowerCase() && topic.id !== topicId
    );

    if (existing) {
      return new Response("A topic with this name already exists", { status: 400 });
    }

    updateTopic(topicId, name, description || '', color);

    return new Response(JSON.stringify({ 
      success: true
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error updating topic:", error);
    return new Response("Internal server error", { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  // Check authentication
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== import.meta.env.SECRET_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const topicId = url.searchParams.get("id");

    if (!topicId) {
      return new Response("Topic ID is required", { status: 400 });
    }

    const id = parseInt(topicId);

    deleteTopic(id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error deleting topic:", error);
    return new Response("Internal server error", { status: 500 });
  }
};