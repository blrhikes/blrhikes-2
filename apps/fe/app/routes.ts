import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("trails", "routes/trails.tsx"),
  route("trails/:slug", "routes/trail-detail.tsx"),
] satisfies RouteConfig;
