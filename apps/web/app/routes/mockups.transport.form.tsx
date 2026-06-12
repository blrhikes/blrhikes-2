// MOCKUP: attendee travel form (self-report). If an organiser pre-filled it,
// the person reviews the pre-filled data and confirms; otherwise they fill it.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { loadDb, persist, hasStart, type MockDb, type TravelMode } from "../lib/mock-store";
import { Breadcrumbs } from "../components/breadcrumbs";

export function meta() {
  return [{ title: "Mockup · Travel form" }];
}

// order here = display order
const MODE_LABEL: Record<TravelMode, string> = {
  own_vehicle: "Car (have spots for others)",
  self_arranged: "Coming on my own",
  needs_pickup: "Need a ride",
};

export default function TravelFormMock() {
  const [db, setDb] = useState<MockDb | null>(null);
  const [me, setMe] = useState("");
  const [form, setForm] = useState({ mode: "needs_pickup" as TravelMode, start: "", maps: "", seats: 0, notes: "" });
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const d = loadDb();
    setDb(d);
    setMe(d.people[0]?.email ?? "");
  }, []);

  // reset the form whenever the viewed person (or the underlying db) changes
  useEffect(() => {
    if (!db || !me) return;
    const p = db.prefs.find((x) => x.email === me);
    setForm({
      mode: p?.travelMode ?? "needs_pickup",
      start: p?.startLocation ?? "",
      maps: p?.startMapsUrl ?? "",
      seats: p?.seatsOffered ?? 0,
      notes: p?.notes ?? "",
    });
    setJustSaved(false);
  }, [me, db]);

  if (!db) return <div className="min-h-screen bg-stone-50 p-10 text-stone-400">Loading…</div>;

  const person = db.people.find((p) => p.email === me);
  const pref = db.prefs.find((p) => p.email === me);
  const status: "none" | "unconfirmed" | "ok" = !pref
    ? "none"
    : pref.enteredBy === "admin" && !pref.confirmed
      ? "unconfirmed"
      : "ok";
  const startOk = hasStart({ startLocation: form.start, startMapsUrl: form.maps });

  function commit(enteredBy: "self" | "admin") {
    setDb((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const data = {
        email: me,
        travelMode: form.mode,
        startLocation: form.start,
        startMapsUrl: form.maps,
        seatsOffered: form.seats,
        notes: form.notes,
        enteredBy,
        confirmed: true,
      };
      const i = next.prefs.findIndex((p) => p.email === me);
      if (i >= 0) next.prefs[i] = data;
      else next.prefs.push(data);

      // option (a): a driver's car capacity = spare seats + their own seat.
      // Remember it on their vehicle so the planner + future forms can reuse it.
      if (form.mode === "own_vehicle") {
        const capacity = form.seats + 1;
        const vi = next.vehicles.findIndex((v) => v.email === me);
        if (vi >= 0) next.vehicles[vi].capacity = capacity;
        else next.vehicles.push({ email: me, type: "car", label: "", capacity });
      }

      persist(next);
      return next;
    });
    setJustSaved(true);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-lg px-5 pt-3">
          <Breadcrumbs trail={[{ label: "Mockups", to: "/mockups" }, { label: "Travel form" }]} />
        </div>
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-5 pb-4 pt-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              How are you getting there?
            </p>
            <h1 className="text-lg font-bold text-stone-900">{db.event.title}</h1>
          </div>
          <div className="flex shrink-0 gap-3 text-sm">
            <Link to="/mockups" className="text-stone-500 hover:text-stone-900">☰ All</Link>
            <Link to="/mockups/transport" className="text-blue-600 hover:underline">← Planner</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-5 py-6">
        {/* view-as picker stands in for auth */}
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

        {/* status banner */}
        {status === "unconfirmed" && !justSaved && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="font-medium text-orange-800">An organiser filled this in for you 📝</p>
            <p className="mt-0.5 text-sm text-orange-700">
              Have a quick look — confirm if it's right, or change anything that isn't.
            </p>
          </div>
        )}
        {justSaved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            ✓ All set — thanks{person ? `, ${person.name.split(" ")[0]}` : ""}!
          </div>
        )}

        {/* the form — one question per card */}
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <p className="text-xl font-semibold text-stone-900">
            How're you coming? <span className="text-rose-500">*</span>
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {(Object.keys(MODE_LABEL) as TravelMode[]).map((m) => (
              <label key={m} className="flex items-center gap-2.5 text-base">
                <input
                  type="radio"
                  name="mode"
                  className="h-4 w-4"
                  checked={form.mode === m}
                  onChange={() => setForm((f) => ({ ...f, mode: m }))}
                />
                {MODE_LABEL[m]}
              </label>
            ))}
          </div>
          <p className="mt-3 text-sm text-stone-400">🏍️ On a bike? Pick “Coming on my own”.</p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <p className="text-xl font-semibold text-stone-900">Where are you starting from?</p>
          <p className="mt-1 text-sm text-stone-400">A place name or a Google Maps link — at least one.</p>
          <input
            value={form.start}
            onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
            placeholder="Place name, e.g. Koramangala"
            className="mt-5 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base"
          />
          <div className="mt-2.5 flex items-center gap-2">
            <input
              value={form.maps}
              onChange={(e) => setForm((f) => ({ ...f, maps: e.target.value }))}
              placeholder="Google Maps link (optional)"
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base"
            />
            {form.maps.trim() && (
              <a href={form.maps} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-blue-600 hover:underline">
                open ↗
              </a>
            )}
          </div>
          {!startOk && (
            <p className="mt-2 text-sm text-rose-600">
              Tell us where you're starting — a name or a maps link.
            </p>
          )}
        </div>

        {form.mode === "own_vehicle" && (
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <p className="text-xl font-semibold text-stone-900">Spare seats you can offer</p>
            <p className="mt-1 text-sm text-stone-400">
              Your own seat is already taken — this is the extra room for others.
            </p>

            {/* stepper */}
            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                aria-label="one fewer seat"
                onClick={() => setForm((f) => ({ ...f, seats: Math.max(0, f.seats - 1) }))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 text-xl leading-none hover:bg-stone-100"
              >
                −
              </button>
              <span className="w-8 text-center text-2xl font-semibold tabular-nums">{form.seats}</span>
              <button
                type="button"
                aria-label="one more seat"
                onClick={() => setForm((f) => ({ ...f, seats: Math.min(7, f.seats + 1) }))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 text-xl leading-none hover:bg-stone-100"
              >
                +
              </button>
            </div>

            {/* seat picture: your seat (taken) + the open seats you're offering */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="flex h-10 items-center gap-1 rounded-full bg-emerald-600 px-3 text-sm font-semibold text-white">
                🧑 You
              </span>
              {Array.from({ length: form.seats }).map((_, i) => (
                <span
                  key={i}
                  title="open seat"
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-sky-300 text-lg text-sky-400"
                >
                  ＋
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-stone-500">
              {form.seats === 0 ? (
                "Just you — driving solo 🚗"
              ) : (
                <>
                  You + {form.seats} other{form.seats > 1 ? "s" : ""} ={" "}
                  <span className="text-xl font-bold text-stone-800">{form.seats + 1}</span> in the car
                </>
              )}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <p className="text-xl font-semibold text-stone-900">Any extra notes</p>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="mt-5 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base"
          />
        </div>

        {/* actions */}
        <div className="flex flex-wrap gap-2">
          {status === "unconfirmed" ? (
            <>
              <button
                disabled={!startOk}
                onClick={() => commit("admin")}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Looks right — confirm
              </button>
              <button
                disabled={!startOk}
                onClick={() => commit("self")}
                className="rounded-lg border border-stone-300 px-4 py-3 text-base font-medium hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save my changes
              </button>
            </>
          ) : (
            <button
              disabled={!startOk}
              onClick={() => commit("self")}
              className="flex-1 rounded-lg bg-stone-900 px-4 py-3 text-base font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Submit
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
