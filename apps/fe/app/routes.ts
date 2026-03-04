import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("trails", "routes/trails.tsx"),
  route("trails/:slug", "routes/trail-detail.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("design", "routes/design.tsx"),
] satisfies RouteConfig;
