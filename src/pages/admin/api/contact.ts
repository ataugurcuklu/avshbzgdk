import type { APIRoute } from "astro";
import fs from "fs/promises";
import path from "path";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const MESSAGES_FILE = path.join(process.cwd(), "src", "data", "contact-messages.json");

// Ensure data directory and file exist
async function ensureDataFile() {
  const dataDir = path.dirname(MESSAGES_FILE);

  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }

  try {
    await fs.access(MESSAGES_FILE);
  } catch {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify([]));
  }
}

// Read messages from file
async function getMessages(): Promise<ContactMessage[]> {
  await ensureDataFile();
  try {
    const data = await fs.readFile(MESSAGES_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save messages to file
async function saveMessages(messages: ContactMessage[]) {
  await ensureDataFile();
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

export const GET: APIRoute = async ({ cookies }) => {
  // Check authentication for admin access
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== "authenticated") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const messages = await getMessages();
    return new Response(JSON.stringify(messages), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error reading messages:", error);
    return new Response(JSON.stringify({ error: "Failed to read messages" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const message = formData.get("message") as string;

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "İsim, e-posta ve mesaj alanları gereklidir." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Create new message
    const newMessage: ContactMessage = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || "",
      message: message.trim(),
      timestamp: new Date().toISOString(),
      read: false
    };

    // Save message
    const messages = await getMessages();
    messages.unshift(newMessage); // Add to beginning
    await saveMessages(messages);

    return new Response(JSON.stringify({ success: true, message: "Mesaj başarıyla gönderildi." }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error saving contact message:", error);
    return new Response(JSON.stringify({ error: "Failed to send message" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  // Check authentication for admin access
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== "authenticated") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { messageId, read } = await request.json();

    const messages = await getMessages();
    const messageIndex = messages.findIndex(msg => msg.id === messageId);

    if (messageIndex === -1) {
      return new Response(JSON.stringify({ error: "Mesaj bulunamadı." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    messages[messageIndex].read = read;
    await saveMessages(messages);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error updating message:", error);
    return new Response(JSON.stringify({ error: "Mesaj güncellenirken bir hata oluştu." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  // Check authentication for admin access
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== "authenticated") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const url = new URL(request.url);
    const messageId = url.searchParams.get("messageId");

    if (!messageId) {
      return new Response(JSON.stringify({ error: "Mesaj ID'si gereklidir." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const messages = await getMessages();
    const filteredMessages = messages.filter(msg => msg.id !== messageId);

    if (filteredMessages.length === messages.length) {
      return new Response(JSON.stringify({ error: "Mesaj bulunamadı." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    await saveMessages(filteredMessages);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return new Response(JSON.stringify({ error: "Mesaj silinirken bir hata oluştu." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
