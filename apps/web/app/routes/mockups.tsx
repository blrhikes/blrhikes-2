// MOCKUP INDEX — hub linking the events/transport prototypes.
// All mockups share one localStorage-backed store (lib/mock-store); state and
// JSON export/import live on the planner screen.
import { Link } from "react-router";
import { SCHEMA_VERSION } from "../lib/mock-store";

export function meta() {
  return [{ title: "Mockups · BLR Hikes" }];
}

type Item = {
  to: string;
  title: string;
  audience: "Admin" | "Attendee";
  blurb: string;
};

const MOCKUPS: Item[] = [
  {
    to: "/mockups/transport",
    title: "Carpool planner",
    audience: "Admin",
    blurb:
      "Drag people into vehicles (first drop = driver). Seat meters, pickup points, per-person notes, fill anyone's form on their behalf, WhatsApp export.",
  },
  {
    to: "/mockups/transport/form",
    title: "Travel form",
    audience: "Attendee",
    blurb:
      "Self-report how you're getting there. If an organiser pre-filled it, review & confirm.",
  },
  {
    to: "/mockups/transport/me",
    title: "My ride",
    audience: "Attendee",
    blurb:
      "Your pickup point, time, driver (with WhatsApp), and who else is in your car.",
  },
  {
    to: "/mockups/transport/plan",
    title: "Full transport plan",
    audience: "Attendee",
    blurb:
      "Read-only view of every vehicle, pickups, and who still needs a ride.",
  },
];

const BADGE: Record<Item["audience"], string> = {
  Admin: "bg-stone-900 text-white",
  Attendee: "bg-accent text-stone-900",
};

export default function MockupsIndex() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Mockups
          </p>
          <h1 className="text-3xl font-bold text-stone-900">Events &amp; transport prototypes</h1>
          <p className="mt-2 text-stone-500">
            Clickable, no backend — everything lives in your browser's localStorage.
            Seed data, JSON export/import, and reset are on the planner's toolbar.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {MOCKUPS.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-stone-900 group-hover:text-accent-hover">
                  {m.title}
                </h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[m.audience]}`}>
                  {m.audience}
                </span>
              </div>
              <p className="text-sm text-stone-500">{m.blurb}</p>
              <span className="mt-3 inline-block text-sm font-medium text-blue-600 group-hover:underline">
                Open →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-xs text-stone-400">
          Data schema v{SCHEMA_VERSION} · bumping it auto-wipes &amp; reseeds stale state.
        </p>
      </main>
    </div>
  );
}
