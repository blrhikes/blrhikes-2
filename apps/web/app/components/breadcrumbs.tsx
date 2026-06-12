import { Link } from "react-router";

export type Crumb = { label: string; to?: string };

/** Simple breadcrumb trail. The last crumb (no `to`) renders as the current page. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-stone-400">
        {trail.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {c.to ? (
              <Link to={c.to} className="hover:text-stone-700 hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className="font-medium text-stone-600" aria-current="page">
                {c.label}
              </span>
            )}
            {i < trail.length - 1 && <span className="text-stone-300">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
