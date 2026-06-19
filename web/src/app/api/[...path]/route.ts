import { DEFAULT_API_BASE_URL } from "@/lib/api/config";
import { isAllowedRoute } from "@/lib/api/routes";

// Headers we must not copy straight through when relaying the response.
const SKIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-encoding", // fetch already decoded the body
  "content-length", // recomputed by the platform
]);

type Context = { params: Promise<{ path: string[] }> };

/**
 * Generic BFF proxy: the browser calls same-origin /api/* and this forwards to
 * the .NET API. The incoming path is validated against the known API surface
 * (generated from the OpenAPI spec) before anything is forwarded, so this can
 * only reach real endpoints.
 */
async function proxy(request: Request, segments: string[]) {
  const apiPath = `/api/${segments.join("/")}`;

  if (!isAllowedRoute(request.method, apiPath)) {
    return Response.json({ message: "Unknown API route." }, { status: 404 });
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const search = new URL(request.url).search;
  const target = `${apiBaseUrl}${apiPath}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const apiResponse = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
  });

  const responseHeaders = new Headers();
  apiResponse.headers.forEach((value, key) => {
    if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new Response(apiResponse.body, {
    status: apiResponse.status,
    statusText: apiResponse.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}

export async function POST(request: Request, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}

export async function PUT(request: Request, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}

export async function PATCH(request: Request, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}

export async function DELETE(request: Request, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
