// MOCKUP: full transport plan — read-only view of every vehicle, for anyone.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { loadDb, destinationSet, addClock, type MockDb, type VehicleType } from "../lib/mock-store";
import { Breadcrumbs } from "../components/breadcrumbs";

export function meta() {
  return [{ title: "Mockup · Full transport plan" }];
}

const ICON: Record<VehicleType, string> = {
  car: "🚗",
  suv: "🚙",
  van: "🚐",
  motorbike: "🏍️",
  other: "🚗",
};


export default function FullPlanMock() {
  const [db, setDb] = useState<MockDb | null>(null);
  useEffect(() => setDb(loadDb()), []);
  if (!db) return <div className="min-h-screen bg-stone-50 p-10 text-stone-400">Loading…</div>;

  const personByEmail = (email: string) => db.people.find((p) => p.email === email);
  const placed = new Set<string>();
  db.plan.vehicles.forEach((v) => {
    placed.add(v.driverEmail);
    v.passengers.forEach((p) => placed.add(p.email));
  });
  const unplaced = db.people.filter((p) => !placed.has(p.email));
  const modeOf = (email: string) => db.prefs.find((p) => p.email === email)?.travelMode;
  const needRide = unplaced.filter((p) => {
    const m = modeOf(p.email);
    return m === "needs_pickup" || m === undefined;
  });
  const ownWay = unplaced.filter((p) => {
    const m = modeOf(p.email);
    return m === "self_arranged" || m === "own_vehicle";
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 pt-3">
          <Breadcrumbs trail={[{ label: "Mockups", to: "/mockups" }, { label: "Full transport plan" }]} />
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 pb-4 pt-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Full transport plan
            </p>
            <h1 className="text-xl font-bold text-stone-900">{db.event.title}</h1>
            <p className="text-sm text-stone-500">{db.event.date} · {db.event.location}</p>
          </div>
          <div className="flex shrink-0 gap-3 text-sm">
            <Link to="/mockups" className="text-stone-500 hover:text-stone-900">☰ All</Link>
            <Link to="/mockups/transport" className="text-blue-600 hover:underline">← Planner</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-6 py-6">
        {!destinationSet(db.plan.destination) ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center">
            <p className="text-2xl">🏁</p>
            <p className="mt-2 font-medium text-rose-800">The trailhead isn't set yet</p>
            <p className="mt-1 text-sm text-rose-700">
              The plan isn't ready to share until the organisers set the destination.
            </p>
          </div>
        ) : (
          <>
            {/* destination (trailhead) */}
            <div className="rounded-xl border border-stone-900 bg-stone-900 px-4 py-3 text-white">
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">🏁 Trailhead</p>
              <p className="text-lg font-bold">{db.plan.destination.label || "(see map)"}</p>
              <p className="text-sm text-stone-300">
                {db.plan.destination.time ? `Reach by ${db.plan.destination.time}` : "Time TBD"}
                {db.plan.destination.mapsUrl && (
                  <>
                    {" · "}
                    <a
                      href={db.plan.destination.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 hover:underline"
                    >
                      open map ↗
                    </a>
                  </>
                )}
              </p>
              {db.plan.destination.notes && (
                <p className="mt-1.5 whitespace-pre-line text-sm text-stone-300">
                  {db.plan.destination.notes}
                </p>
              )}
            </div>

            {db.plan.vehicles.length === 0 && (
              <p className="text-sm text-stone-400">No carpools planned yet.</p>
            )}

        {db.plan.vehicles.map((v) => {
          const driver = personByEmail(v.driverEmail);
          const occ = 1 + v.passengers.length;
          const start = v.pickups[0];
          const eta = addClock(start?.time ?? "", v.travelMinutes);
          const tbd = v.passengers.filter((p) => p.pickupId === null);
          return (
            <div key={v.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-stone-100 bg-stone-50 px-4 py-3">
                <div>
                  <p className="font-semibold">
                    {ICON[v.type]} {driver?.name ?? "?"}{v.label ? ` · ${v.label}` : ""}
                  </p>
                  <p className="text-xs text-stone-500">
                    {start?.label ? `from ${start.label}` : "start TBD"}
                    {start?.time ? ` · departs ${start.time}` : ""}
                    {eta ? ` · ETA ${eta}` : ""}
                    {v.routeUrl && (
                      <>
                        {" · "}
                        <a
                          href={v.routeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          route ↗
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  {occ}/{v.capacity}
                </span>
              </div>
              <ul className="divide-y divide-stone-100">
                {v.pickups.map((pk, i) => {
                  const here = v.passengers.filter((p) => p.pickupId === pk.id);
                  return (
                    <li key={pk.id} className="px-4 py-2">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-stone-400">
                        <span>
                          {i === 0 ? "Start" : `Pickup ${i}`}
                          {pk.label ? ` · ${pk.label}` : ""}
                          {pk.mapsUrl && (
                            <a
                              href={pk.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 normal-case text-blue-600 hover:underline"
                            >
                              map ↗
                            </a>
                          )}
                        </span>
                        {pk.time && <span>{pk.time}</span>}
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {i === 0 && (
                          <li className="flex items-center justify-between text-sm">
                            <span className="font-medium">{driver?.name ?? "?"}</span>
                            <span className="text-xs text-stone-400">driving</span>
                          </li>
                        )}
                        {here.map((p) => (
                          <li key={p.email} className="text-sm">
                            {personByEmail(p.email)?.name ?? p.email}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
                {tbd.length > 0 && (
                  <li className="px-4 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                      Pickup TBD
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {tbd.map((p) => (
                        <li key={p.email} className="text-sm">
                          {personByEmail(p.email)?.name ?? p.email}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </div>
          );
        })}

            {db.plan.stops.length > 0 && (
              <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Stops along the way
                </p>
                <ul className="space-y-1.5">
                  {db.plan.stops.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        {s.label || "Stop"}
                        {s.mapsUrl && (
                          <a
                            href={s.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-xs text-blue-600 hover:underline"
                          >
                            map ↗
                          </a>
                        )}
                      </span>
                      {s.time && <span className="text-xs text-stone-400">{s.time}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {needRide.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-medium text-amber-800">
                  Still need a ride ({needRide.length})
                </p>
                <p className="text-sm text-amber-700">
                  {needRide.map((p) => p.name).join(", ")}
                </p>
              </div>
            )}

            {ownWay.length > 0 && (
              <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-sm font-medium text-stone-600">
                  Coming on their own ({ownWay.length})
                </p>
                <p className="text-sm text-stone-500">
                  {ownWay.map((p) => p.name).join(", ")}
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
