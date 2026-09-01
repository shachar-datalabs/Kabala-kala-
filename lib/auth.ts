export function authenticatedOwnerId(request: Request) {
  const authenticatedId = request.headers.get("oai-authenticated-user-id");
  if (authenticatedId) return authenticatedId;
  return process.env.NODE_ENV === "production" ? null : "local-preview";
}
