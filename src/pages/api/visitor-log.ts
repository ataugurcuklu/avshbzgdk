import type { APIRoute } from "astro";
import fs from "fs/promises";
import path from "path";

interface VisitorLog {
  id: string;
  ip: string;
  userAgent: string;
  visitDate: string;
  page: string;
  referer?: string;
}

const VISITOR_LOG_FILE = path.join(process.cwd(), "src", "data", "visitor-logs.json");

// Ensure data directory and file exist
async function ensureLogFile() {
  const dataDir = path.dirname(VISITOR_LOG_FILE);
  
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
  
  try {
    await fs.access(VISITOR_LOG_FILE);
  } catch {
    await fs.writeFile(VISITOR_LOG_FILE, JSON.stringify([]));
  }
}

// Read visitor logs from file
async function getVisitorLogs(): Promise<VisitorLog[]> {
  await ensureLogFile();
  try {
    const data = await fs.readFile(VISITOR_LOG_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save visitor logs to file
async function saveVisitorLogs(logs: VisitorLog[]) {
  await ensureLogFile();
  await fs.writeFile(VISITOR_LOG_FILE, JSON.stringify(logs, null, 2));
}

// Get client IP address
function getClientIP(request: Request): string {
  // Check various headers for IP address
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (xRealIP) {
    return xRealIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback - this might not work in all environments
  return 'unknown';
}

export const GET: APIRoute = async ({ request, cookies }) => {
  // Check authentication for admin access
  const authCookie = cookies.get("auth");
  if (!authCookie || authCookie.value !== "authenticated") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const logs = await getVisitorLogs();
    return new Response(JSON.stringify(logs), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error fetching visitor logs:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch visitor logs" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { page } = body;
    
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const referer = request.headers.get('referer') || undefined;
    
    const newLog: VisitorLog = {
      id: Date.now().toString(),
      ip,
      userAgent,
      visitDate: new Date().toISOString(),
      page: page || 'unknown',
      referer
    };

    console.log('New visitor log:', newLog);

    // Get existing logs
    const logs = await getVisitorLogs();
    
    // Add new log to beginning
    logs.unshift(newLog);
    
    // Keep only last 1000 entries to prevent file from growing too large
    if (logs.length > 1000) {
      logs.splice(1000);
    }
    
    // Save updated logs
    await saveVisitorLogs(logs);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error saving visitor log:", error);
    return new Response(JSON.stringify({ error: "Failed to save visitor log" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};