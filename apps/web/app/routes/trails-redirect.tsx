import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug ?? "";
  const rest = params["*"] ? `/${params["*"]}` : "";
  throw redirect(`/trail/${slug}${rest}`, 301);
}

export default function TrailsRedirect() {
  return null;
}
