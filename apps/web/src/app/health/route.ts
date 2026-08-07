export function GET(): Response {
  return Response.json(
    { service: "tarjih-web", status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
