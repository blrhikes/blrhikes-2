import { createRequestHandler } from "react-router";
import type { AuthUser } from "@blrhikes/shared";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    user: AuthUser | null;
    payloadToken: string | null;
    cmsUrl: string;
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function resolveUser(
  token: string,
  cmsUrl: string
): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${cmsUrl}/api/users/me`, {
      headers: { Cookie: `payload-token=${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: AuthUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const payloadToken = getCookie(request, "payload-token");
    let user: AuthUser | null = null;

    if (payloadToken) {
      user = await resolveUser(payloadToken, env.CMS_URL || "http://localhost:3000");
    }

    return requestHandler(request, {
      cloudflare: { env, ctx },
      user,
      payloadToken,
      cmsUrl: env.CMS_URL || "http://localhost:3000",
    });
  },
} satisfies ExportedHandler<Env>;
