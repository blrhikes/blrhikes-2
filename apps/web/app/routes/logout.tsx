import { redirect } from "react-router";
import type { Route } from "./+types/logout";

export async function action({ context }: Route.ActionArgs) {
  const cmsUrl = context.cmsUrl;
  const isProduction = cmsUrl.includes("blrhikes.com");

  const cookieParts = [
    "payload-token=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProduction) {
    cookieParts.push("Domain=.blrhikes.com", "Secure");
  }

  return redirect("/trails", {
    headers: { "Set-Cookie": cookieParts.join("; ") },
  });
}
