import express from "express";
import basicAuth from "basic-auth";
import { handler as ssrHandler } from "./dist/server/entry.mjs";

const app = express();
app.use(express.static("dist/client/"));

// Basic Auth Middleware
const auth = (req, res, next) => {
  const user = basicAuth(req);
  if (user && user.name === "admin" && user.pass === "password") {
    return next();
  } else {
    res.set("WWW-Authenticate", 'Basic realm="example"');
    return res.status(401).send("Authentication required.");
  }
};

// Apply auth middleware to /admin/* path
app.use("/admin/*", auth);

app.use((req, res, next) => {
  const locals = {
    title: "New title",
  };

  ssrHandler(req, res, next, locals);
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
