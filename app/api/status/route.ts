import { getEzcountStatus } from "@/services/easycount";

export async function GET(request: Request) {
  if (!request.headers.get("oai-authenticated-user-id") && process.env.NODE_ENV === "production") {
    return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  }
  const status = getEzcountStatus();
  return Response.json({
    connected: status.configured,
    safeMode: !status.enabled,
    environment: status.environment,
    supportedDocuments: ["receipt", "proforma"],
  });
}
