// Liveness is independent of catalog regions, authentication and backend caches.
export function GET() {
  return Response.json({ status: "ok" })
}
