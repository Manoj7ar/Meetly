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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/room" && request.method === "POST") {
      const code = makeRoomCode();
      const origin = url.origin;
      return Response.json({
        room: code,
        url: `${origin}/${code}`,
        wsUrl: `${origin.replace(/^http/, "ws")}/call?room=${encodeURIComponent(code)}`,
      });
    }

    if (url.pathname === "/call") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }
      const room = url.searchParams.get("room") ?? "";
      if (!room.startsWith(ROOM_PREFIX) || room.length > 40) {
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
