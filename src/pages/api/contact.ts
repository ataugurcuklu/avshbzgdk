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

export const POST: APIRoute = async ({ request }) => {
  console.log("Contact form submission received");
  try {
    const formData = await request.formData();
    
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const message = formData.get("message") as string;

    console.log("Form data:", { name, email, phone, message });

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Name, email, and message are required" }), {
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

    console.log("Message saved successfully:", newMessage);

    return new Response(JSON.stringify({ success: true, message: "Message sent successfully" }), {
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