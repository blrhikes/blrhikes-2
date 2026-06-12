import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("trails", "routes/trails.tsx"),
  route("trail/:slug", "routes/trail-detail.tsx", [
    route("photo/:photoId", "routes/trail-photo.tsx"),
  ]),
  // Legacy plural path → 301 to canonical singular /trail/:slug (preserves /photo/:photoId).
  route("trails/:slug/*", "routes/trails-redirect.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("design", "routes/design.tsx"),
  route("mockups", "routes/mockups.tsx"),
  route("mockups/transport", "routes/mockups.transport.tsx"),
  route("mockups/transport/plan", "routes/mockups.transport.plan.tsx"),
  route("mockups/transport/me", "routes/mockups.transport.me.tsx"),
  route("mockups/transport/form", "routes/mockups.transport.form.tsx"),
] satisfies RouteConfig;
