import { getEzcountStatus } from "@/lib/ezcount";

export async function GET() {
  const status = getEzcountStatus();
  return Response.json({
    connected: status.configured,
    environment: status.environment,
    supportedDocuments: ["receipt", "proforma"],
  });
}
