export { CallRoom } from "./call-room.js";

const ROOM_PREFIX = "MEETLY-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoomCode(): string {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  let s = ROOM_PREFIX;
  for (let i = 0; i < 6; i++) s += CODE_CHARS[arr[i]! % CODE_CHARS.length];
  return s;
}

function isValidRoomCode(code: string): boolean {
  return code.startsWith(ROOM_PREFIX) && code.length <= 40;
}

/** Lets the static UI (e.g. Vercel) call the Worker API cross-origin. */
const CORS_API: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function withApiCors(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_API)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function jsonWithCors(data: unknown, init?: ResponseInit): Response {
  const res = Response.json(data, init);
  return withApiCors(res);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathNorm = url.pathname.replace(/\/+$/, "") || "/";

    const metaMatch = pathNorm.match(/^\/api\/room\/(MEETLY-[A-Z0-9-]+)\/meta$/);

    if (request.method === "OPTIONS") {
      if (pathNorm === "/api/room" || metaMatch) {
        return new Response(null, { status: 204, headers: CORS_API });
      }
    }

    if (pathNorm === "/api/room" && request.method === "POST") {
      const code = makeRoomCode();
      const origin = url.origin;
      return jsonWithCors({
        room: code,
        url: `${origin}/${code}`,
        wsUrl: `${origin.replace(/^http/, "ws")}/call?room=${encodeURIComponent(code)}`,
      });
    }

    if (request.method === "GET" && metaMatch) {
      const code = metaMatch[1]!;
      if (!isValidRoomCode(code)) {
        return withApiCors(new Response("Invalid room", { status: 400 }));
      }
      const id = env.CALL_ROOM.idFromName(code);
      const stub = env.CALL_ROOM.get(id);
      const metaRes = await stub.fetch(new Request("https://internal/__meta", { method: "GET" }));
      return withApiCors(metaRes);
    }

    if (url.pathname === "/call") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }
      const room = url.searchParams.get("room") ?? "";
      if (!isValidRoomCode(room)) {
        return new Response("Invalid room", { status: 400 });
      }
      const id = env.CALL_ROOM.idFromName(room);
      const stub = env.CALL_ROOM.get(id);
      return stub.fetch(request);
    }

    let res = await env.ASSETS.fetch(request);
    if (res.status === 404) {
      const p = url.pathname;
      if (!p.includes(".") || p === "/" || p.endsWith("/")) {
        res = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
      }
    }
    return res;
  },
} satisfies ExportedHandler<Env>;
