import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/login";
import { BottomNav } from "../components/bottom-nav";

export function meta() {
  return [{ title: "Login | BLR Hikes" }];
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const cmsUrl = context.cmsUrl;

  const res = await fetch(`${cmsUrl}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    return { error: "Invalid email or password" };
  }

  const data = (await res.json()) as { token?: string };

  if (!data.token) {
    return { error: "Login failed — no token received" };
  }

  const isProduction = cmsUrl.includes("blrhikes.com");
  const cookieParts = [
    `payload-token=${data.token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
  ];
  if (isProduction) {
    cookieParts.push("Domain=.blrhikes.com", "Secure");
  }

  return redirect("/trails", {
    headers: { "Set-Cookie": cookieParts.join("; ") },
  });
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const error = actionData?.error;

  return (
    <div className="min-h-screen bg-stone-50 pb-20 sm:pb-0">
      <nav className="border-b border-stone-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/trails" className="text-2xl font-bold tracking-tight text-stone-900">
            BLRHikes
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-sm px-6 pt-16">
        <h1 className="mb-8 text-3xl font-bold text-stone-900">Log in</h1>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <Form method="post" className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border-2 border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border-2 border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-accent-hover"
          >
            Log in
          </button>
        </Form>
      </main>
      <BottomNav />
    </div>
  );
}
