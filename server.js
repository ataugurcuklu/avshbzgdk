import express from "express";
import { handler as ssrHandler } from "./dist/server/entry.mjs";

const app = express();

// Trust proxy - important for reverse proxy setups
app.set('trust proxy', true);

// Parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static("dist/client/"));

// Add headers for CORS and security
app.use((req, res, next) => {
  // Get the protocol from headers or default
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  
  // Set CORS headers to allow requests from the same origin
  const origin = req.headers.origin || `${protocol}://${req.get('x-forwarded-host') || req.get('host')}`;
  
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, HX-Request, HX-Trigger, HX-Target, HX-Current-URL');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

app.use((req, res, next) => {
  const locals = {
    title: "New title",
  };

  ssrHandler(req, res, next, locals);
});

app.listen(4321, () => {
  console.log("Server is running on http://localhost:4321");
});
