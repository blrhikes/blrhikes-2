import { useSearchParams, Form, Link } from "react-router";
import type { Route } from "./+types/trails";
import { fetchTrails } from "../lib/api.server";
import {
  DIFFICULTY_OPTIONS,
  HIGHLIGHT_OPTIONS,
  ACCESS_OPTIONS,
  AREA_OPTIONS,
} from "@blrhikes/shared";
import type {
  Difficulty,
  Highlight,
  Access,
  Area,
  TrailListParams,
} from "@blrhikes/shared";
import { TrailCard } from "../components/trail-card";
import { useState } from "react";

export function meta() {
  return [
    { title: "Trails | BLR Hikes" },
    {
      name: "description",
      content: "Discover hiking trails near Bangalore",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params: TrailListParams = {
    search: url.searchParams.get("search") || undefined,
    difficulty: url.searchParams.getAll("difficulty") as Difficulty[],
    highlights: url.searchParams.getAll("tag") as Highlight[],
    access: url.searchParams.getAll("access") as Access[],
    hikingDuration: url.searchParams.get("duration") || undefined,
    area: url.searchParams.getAll("area") as Area[],
    sort: url.searchParams.get("sort") || undefined,
    page: url.searchParams.get("page")
      ? Number(url.searchParams.get("page"))
      : undefined,
  };

  const data = await fetchTrails(params);
  return { trails: data.docs, totalDocs: data.totalDocs, params };
}

function CheckboxGroup({
  name,
  label,
  options,
  selected,
}: {
  name: string;
  label: string;
  options: readonly string[];
  selected: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <fieldset className="border-b border-stone-200 pb-4">
      <button
        type="button"
        className="flex w-full items-center justify-between py-2 text-sm font-medium text-stone-900"
        onClick={() => setIsOpen(!isOpen)}
      >
        {label}
        <span className="text-stone-400">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={name}
                value={option}
                defaultChecked={selected.includes(option)}
                className="rounded border-stone-300 text-accent focus:ring-accent"
              />
              <span className="text-stone-700">{option}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function RadioGroup({
  name,
  label,
  options,
  selected,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  selected: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <fieldset className="border-b border-stone-200 pb-4">
      <button
        type="button"
        className="flex w-full items-center justify-between py-2 text-sm font-medium text-stone-900"
        onClick={() => setIsOpen(!isOpen)}
      >
        {label}
        <span className="text-stone-400">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              value=""
              defaultChecked={!selected}
              className="border-stone-300 text-accent focus:ring-accent"
            />
            <span className="text-stone-700">Any</span>
          </label>
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                defaultChecked={selected === option.value}
                className="border-stone-300 text-accent focus:ring-accent"
              />
              <span className="text-stone-700">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export default function TrailsPage({ loaderData }: Route.ComponentProps) {
  const { trails, totalDocs, params } = loaderData;
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list" | "table">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Nav */}
      <nav className="border-b border-stone-200">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
          <Link to="/trails" className="text-2xl font-bold tracking-tight text-stone-900">
            BLRHikes
          </Link>
          <div className="flex gap-8 text-sm">
            <span className="font-semibold text-accent">Trails</span>
            <a href="#" className="text-stone-500 hover:text-stone-900 transition">Community</a>
            <a href="#" className="text-stone-500 hover:text-stone-900 transition">Events</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-4xl font-bold mb-1">Trails</h1>
        <p className="text-stone-500 mb-8">Curated hikes within reach of Bangalore</p>

        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          {/* Mobile filter toggle */}
          <button
            className="mb-4 flex items-center gap-2 rounded-lg border-2 border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 lg:hidden"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            Filters {filtersOpen ? "−" : "+"}
          </button>

          {/* Sidebar filters */}
          <aside className={`${filtersOpen ? "block" : "hidden"} lg:block`}>
            <Form method="get" className="space-y-4 rounded-2xl border-2 border-stone-200 bg-stone-100 p-5">
              {/* Search */}
              <div>
                <label
                  htmlFor="search"
                  className="block text-sm font-medium text-stone-900"
                >
                  Search
                </label>
                <input
                  type="text"
                  id="search"
                  name="search"
                  defaultValue={params.search || ""}
                  placeholder="Trail name or area..."
                  className="mt-1 w-full rounded-lg border-2 border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <CheckboxGroup
                name="difficulty"
                label="Difficulty"
                options={DIFFICULTY_OPTIONS}
                selected={params.difficulty || []}
              />
              <CheckboxGroup
                name="tag"
                label="Highlights"
                options={HIGHLIGHT_OPTIONS}
                selected={params.highlights || []}
              />
              <CheckboxGroup
                name="access"
                label="Access"
                options={ACCESS_OPTIONS}
                selected={params.access || []}
              />
              <CheckboxGroup
                name="area"
                label="Area"
                options={AREA_OPTIONS}
                selected={params.area || []}
              />
              <RadioGroup
                name="duration"
                label="Hiking Duration"
                options={[
                  { value: "short", label: "Short (<2h)" },
                  { value: "medium", label: "Medium (2-4h)" },
                  { value: "long", label: "Long (>4h)" },
                ]}
                selected={params.hikingDuration || ""}
              />

              {/* Sort */}
              <div>
                <label
                  htmlFor="sort"
                  className="block text-sm font-medium text-stone-900"
                >
                  Sort by
                </label>
                <select
                  id="sort"
                  name="sort"
                  defaultValue={params.sort || ""}
                  className="mt-1 w-full rounded-lg border-2 border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                >
                  <option value="">Default</option>
                  <option value="difficulty">Difficulty (easy → hard)</option>
                  <option value="-difficulty">Difficulty (hard → easy)</option>
                  <option value="hikingTime">Hiking time (short → long)</option>
                  <option value="-hikingTime">Hiking time (long → short)</option>
                  <option value="rating">Rating (low → high)</option>
                  <option value="-rating">Rating (high → low)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-accent-hover transition"
              >
                Apply Filters
              </button>
            </Form>
          </aside>

          {/* Main content */}
          <div>
            {/* Results bar */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-stone-500">
                {totalDocs} trail{totalDocs !== 1 ? "s" : ""} found
              </p>
              <div className="flex gap-1">
                {(["grid", "list", "table"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`rounded-lg px-3 py-1 text-sm transition ${
                      viewMode === mode
                        ? "bg-accent font-semibold text-stone-900"
                        : "border-2 border-stone-200 bg-stone-100 text-stone-500 hover:border-accent"
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Trails */}
            {trails.length === 0 ? (
              <div className="rounded-2xl border-2 border-stone-200 bg-stone-100 p-12 text-center">
                <p className="text-stone-500">
                  No trails match your filters. Try adjusting your search.
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid gap-6 grid-cols-2">
                {trails.map((trail: any) => (
                  <TrailCard key={trail.id} trail={trail} mode="grid" />
                ))}
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-3">
                {trails.map((trail: any) => (
                  <TrailCard key={trail.id} trail={trail} mode="list" />
                ))}
              </div>
            ) : (
              <TrailTable trails={trails} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function formatMinutes(minutes: number | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const difficultyBadge: Record<string, string> = {
  easy: "border-2 border-stone-200 text-accent",
  "easy-moderate": "border-2 border-stone-200 text-accent",
  moderate: "bg-accent text-stone-50",
  "moderate-hard": "border-2 border-accent bg-accent/10 text-accent",
  hard: "bg-stone-200 text-stone-700",
};

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const cls = difficultyBadge[difficulty] || "bg-stone-200 text-stone-700";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${cls}`}>
      {difficulty}
    </span>
  );
}

function TrailTable({ trails }: { trails: any[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-stone-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-100 text-xs uppercase tracking-wider text-stone-500">
            <th className="text-left px-4 py-3 border-b border-stone-200">Trail</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Area</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Difficulty</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Distance</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Elevation</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Time</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Drive</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Rating</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Tags</th>
          </tr>
        </thead>
        <tbody>
          {trails.map((trail: any) => {
            const imageUrl =
              trail.coverImage && typeof trail.coverImage !== "string"
                ? trail.coverImage.url
                : undefined;
            return (
              <tr key={trail.id} className="border-b border-stone-200 hover:bg-accent/5 transition">
                <td className="px-4 py-3">
                  <Link to={`/trails/${trail.slug}`} className="hover:text-accent transition">
                    <div className="flex items-center gap-3">
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={trail.title}
                          className="h-10 w-14 rounded object-cover flex-shrink-0"
                          loading="lazy"
                        />
                      )}
                      <span className="font-bold font-serif">{trail.title}</span>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-stone-500">{trail.area || "—"}</td>
                <td className="px-4 py-3">
                  {trail.difficulty && <DifficultyBadge difficulty={trail.difficulty} />}
                </td>
                <td className="px-4 py-3">{trail.length != null ? `${trail.length} km` : "—"}</td>
                <td className="px-4 py-3">{trail.elevationGain != null ? `${trail.elevationGain}m` : "—"}</td>
                <td className="px-4 py-3">{formatMinutes(trail.hikingTime)}</td>
                <td className="px-4 py-3">{trail.drivingDistanceText || "—"}</td>
                <td className="px-4 py-3 text-accent font-semibold">
                  {trail.rating != null ? `★ ${trail.rating}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {trail.highlights?.slice(0, 3).map((h: string) => (
                      <span key={h} className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs">
                        {h}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
