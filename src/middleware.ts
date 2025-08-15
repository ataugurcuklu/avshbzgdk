import { defineMiddleware } from "astro/middleware";

export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);
  console.log(`Request URL: ${url.pathname}`);

  const authCookie = context.cookies.get("auth");
  console.log(`Auth Cookie: ${authCookie?.value}`);

  if (url.pathname.startsWith("/admin")) {
    if (authCookie?.value === "authenticated") {
      console.log("Authenticated via cookie");
      return next();
    }

    const basicAuth = context.request.headers.get("authorization");

    if (basicAuth) {
      // Get the auth value from string "Basic authValue"
      const authValue = basicAuth.split(" ")[1] ?? "username:password";

      // Decode the Base64 encoded string via atob (https://developer.mozilla.org/en-US/docs/Web/API/atob)
      // Get the username and password. NB: the decoded string is in the form "username:password"
      const [username, pwd] = atob(authValue).split(":");

      // Check if the username and password are valid
      if (username === "admin" && pwd === "password") {
        console.log("Authentication successful");
        context.cookies.set("auth", "authenticated", {
          path: "/",
          httpOnly: false,  // Allow JavaScript access
          secure: false,    // Allow HTTP in development
          sameSite: "strict"
        });
        // Forward request
        return next();
      }
    }

    console.log("Authentication required");
    return new Response(JSON.stringify({ error: "Auth required" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-authenticate": 'Basic realm="Secure Area"',
      },
    });
  } else {
    console.log("Non-admin route accessed");
  }

  return next();
});