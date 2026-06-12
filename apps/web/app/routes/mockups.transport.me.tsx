// MOCKUP: hiker view — "my ride". Shows the signed-in hiker their pickup point
// and the other people in their vehicle. A "view as" picker stands in for auth.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { loadDb, type MockDb, type VehicleType } from "../lib/mock-store";
import { Breadcrumbs } from "../components/breadcrumbs";

export function meta() {
  return [{ title: "Mockup · My ride" }];
}

const ICON: Record<VehicleType, string> = {
  car: "🚗",
  suv: "🚙",
  van: "🚐",
  motorbike: "🏍️",
  other: "🚗",
};

export default function HikerRideMock() {
  const [db, setDb] = useState<MockDb | null>(null);
  const [me, setMe] = useState<string>("");
  useEffect(() => {
    const d = loadDb();
    setDb(d);
    setMe(d.people[0]?.email ?? "");
  }, []);
  if (!db) return <div className="min-h-screen bg-stone-50 p-10 text-stone-400">Loading…</div>;

  const personByEmail = (email: string) => db.people.find((p) => p.email === email);

  // find my vehicle: am I a driver, or seated as a passenger?
  const myVehicle = db.plan.vehicles.find(
    (v) => v.driverEmail === me || v.passengers.some((p) => p.email === me),
  );
  const iDrive = myVehicle?.driverEmail === me;
  const mySeat = myVehicle?.passengers.find((p) => p.email === me);
  const driver = myVehicle ? personByEmail(myVehicle.driverEmail) : undefined;
  const startPk = myVehicle?.pickups[0];
  const pickupOf = (pickupId: string | null) =>
    myVehicle?.pickups.find((pk) => pk.id === pickupId);
  const mySeatPk = mySeat ? pickupOf(mySeat.pickupId) : undefined;
  const coRiders = myVehicle
    ? [
        ...(iDrive
          ? []
          : [{ email: myVehicle.driverEmail, driving: true, label: startPk?.label ?? "", time: startPk?.time ?? "" }]),
        ...myVehicle.passengers
          .filter((p) => p.email !== me)
          .map((p) => {
            const pk = pickupOf(p.pickupId);
            return { email: p.email, driving: false, label: pk?.label ?? "", time: pk?.time ?? "" };
          }),
      ]
    : [];

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-md px-5 pt-3">
          <Breadcrumbs trail={[{ label: "Mockups", to: "/mockups" }, { label: "My ride" }]} />
        </div>
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 pb-4 pt-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Your ride</p>
            <h1 className="text-lg font-bold text-stone-900">{db.event.title}</h1>
          </div>
          <div className="flex shrink-0 gap-3 text-sm">
            <Link to="/mockups" className="text-stone-500 hover:text-stone-900">☰ All</Link>
            <Link to="/mockups/transport/plan" className="text-blue-600 hover:underline">Full plan →</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 py-6">
        {/* view-as picker (stands in for auth) */}
        <label className="flex items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-white px-3 py-2 text-xs text-stone-500">
          <span className="shrink-0">Viewing as</span>
          <select
            value={me}
            onChange={(e) => setMe(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1 text-sm text-stone-800"
          >
            {db.people.map((p) => (
              <option key={p.email} value={p.email}>{p.name}</option>
            ))}
          </select>
        </label>

        {!myVehicle && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
            <p className="text-2xl">🤔</p>
            <p className="mt-2 font-medium text-amber-800">You're not in a car yet</p>
            <p className="mt-1 text-sm text-amber-700">
              The organisers are still sorting carpools. Check back soon.
            </p>
          </div>
        )}

        {myVehicle && (
          <>
            {/* my pickup / driving status */}
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              {iDrive ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    You're driving {ICON[myVehicle.type]}
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    Start from {startPk?.label || "— set your start —"}
                  </p>
                  {startPk?.time && (
                    <p className="text-sm text-stone-500">Departing {startPk.time}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Your pickup
                  </p>
                  <p className="mt-1 text-lg font-bold">{mySeatPk?.label || "— pickup TBD —"}</p>
                  <p className="text-sm text-stone-500">
                    {mySeatPk?.time ? `Be there by ${mySeatPk.time}` : "Time TBD"}
                    {" · "}
                    {ICON[myVehicle.type]} {driver?.name}'s {myVehicle.label || "car"}
                  </p>
                  {driver?.phone && (
                    <a
                      href={`https://wa.me/${driver.phone.replace(/[\s+]/g, "")}`}
                      className="mt-2 inline-block text-sm text-emerald-600 hover:underline"
                    >
                      WhatsApp {driver.name} →
                    </a>
                  )}
                </>
              )}
            </div>

            {/* who's in my car */}
            <div className="rounded-xl border border-stone-200 bg-white">
              <p className="border-b border-stone-100 px-4 py-2 text-sm font-semibold text-stone-700">
                In your car ({1 + myVehicle.passengers.length}/{myVehicle.capacity})
              </p>
              <ul className="divide-y divide-stone-100">
                {coRiders.length === 0 && (
                  <li className="px-4 py-3 text-sm text-stone-400">
                    Just you so far.
                  </li>
                )}
                {coRiders.map((r) => (
                  <li key={r.email} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">
                      {personByEmail(r.email)?.name ?? r.email}
                      {r.driving && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                          driving
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-stone-400">
                      {r.label || "pickup TBD"}{r.time ? ` · ${r.time}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-center text-xs text-stone-400">
              Want to see the other cars?{" "}
              <Link to="/mockups/transport/plan" className="text-blue-600 hover:underline">
                Full transport plan
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
