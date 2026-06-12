// ---------------------------------------------------------------------------
// MOCKUP: drag-drop carpool planner.
//
// No backend — state lives in localStorage (see lib/mock-store). Drag a person
// onto the "new vehicle" zone to make them the driver/owner of a fresh vehicle;
// drag others into a vehicle to seat them; drag anyone back to the pool to
// unassign. Export/import the whole state as JSON to save & reload.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Breadcrumbs } from "../components/breadcrumbs";
import {
  SCHEMA_VERSION,
  loadDb,
  persist,
  resetDb,
  exportDb,
  importDb,
  hasStart,
  destinationSet,
  hmToMinutes,
  minutesToHM,
  addClock,
  type MockDb,
  type PlanVehicle,
  type Person,
  type Pref,
  type SavedVehicle,
  type TravelMode,
  type VehicleType,
} from "../lib/mock-store";

export function meta() {
  return [{ title: "Mockup · Carpool planner" }];
}

const VEHICLE_ICON: Record<VehicleType, string> = {
  car: "🚗",
  suv: "🚙",
  van: "🚐",
  motorbike: "🏍️",
  other: "🚗",
};

const DRAG_KEY = "application/x-blrhikes-email";

const firstName = (full?: string) => (full ?? "").trim().split(/\s+/)[0] || "?";

/** "06:15" → "6:15 am". */
const to12h = (hhmm: string): string => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const ampm = h < 12 ? "am" : "pm";
  const hh = h % 12 || 12;
  return `${hh}:${String(m || 0).padStart(2, "0")} ${ampm}`;
};

/** 135 → "2 hr 15 min". */
const formatDuration = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hr`);
  if (m) parts.push(`${m} min`);
  return parts.join(" ");
};

export default function TransportPlannerMock() {
  // db is null until mounted, so SSR and first client render match (no
  // localStorage on the server). The effect hydrates it.
  const [db, setDb] = useState<MockDb | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null); // dropzone id under cursor
  const [formEmail, setFormEmail] = useState<string | null>(null); // who's form the admin is editing
  const fileRef = useRef<HTMLInputElement>(null);
  const idSeq = useRef(0);
  // time-prefixed so ids never collide with ones persisted in a previous load
  // (a bare counter resets to 0 each reload and re-issued v0/pk1, clobbering rows).
  const uid = (p: string) => `${p}_${Date.now().toString(36)}_${idSeq.current++}`;

  useEffect(() => {
    setDb(loadDb());
  }, []);

  function update(mutator: (d: MockDb) => void) {
    setDb((prev) => {
      if (!prev) return prev;
      const next: MockDb = structuredClone(prev);
      mutator(next);
      persist(next);
      return next;
    });
  }

  if (!db) {
    return (
      <div className="min-h-screen bg-stone-50 p-10 text-stone-400">Loading mock…</div>
    );
  }

  // ---- derived lookups ----
  const personByEmail = (email: string): Person | undefined =>
    db.people.find((p) => p.email === email);
  const savedVehicleFor = (email: string) =>
    db.vehicles.find((v) => v.email === email);
  const prefFor = (email: string) => db.prefs.find((p) => p.email === email);
  const filledForm = (email: string) => !!prefFor(email);
  const notesFor = (email: string) => prefFor(email)?.notes ?? "";
  const startFor = (email: string) => ({
    label: prefFor(email)?.startLocation ?? "",
    mapsUrl: prefFor(email)?.startMapsUrl ?? "",
  });
  // none = no form; unconfirmed = admin filled, person hasn't confirmed; ok = good
  const statusFor = (email: string): "none" | "unconfirmed" | "ok" => {
    const p = prefFor(email);
    if (!p) return "none";
    return p.enteredBy === "admin" && !p.confirmed ? "unconfirmed" : "ok";
  };

  const placed = new Set<string>();
  for (const v of db.plan.vehicles) {
    placed.add(v.driverEmail);
    v.passengers.forEach((p) => placed.add(p.email));
  }
  const pool = db.people.filter((p) => !placed.has(p.email));
  // Order: vehicle owners first (seat cars first), then people who haven't filled
  // the form (chase them), then everyone else who's filled it.
  const poolDrivers = pool.filter((p) => savedVehicleFor(p.email));
  const poolRest = pool.filter((p) => !savedVehicleFor(p.email));
  const poolNoForm = poolRest.filter((p) => !filledForm(p.email));
  const poolRiders = poolRest.filter((p) => filledForm(p.email));

  const occupants = (v: PlanVehicle) => 1 + v.passengers.length;
  const seatsTotal = db.plan.vehicles.reduce((n, v) => n + v.capacity, 0);
  const overflow = db.plan.vehicles.reduce(
    (n, v) => n + Math.max(0, occupants(v) - v.capacity),
    0,
  );

  // ETA = start time (first pickup) + travel time. Flag if the cars don't all
  // arrive within a 15-minute window of each other.
  const ETA_WINDOW = 15;
  const etaClockOf = (v: PlanVehicle) => addClock(v.pickups[0]?.time ?? "", v.travelMinutes);
  const etaMinutesOf = (v: PlanVehicle): number | null => {
    const dep = v.pickups[0]?.time;
    return dep ? hmToMinutes(dep) + v.travelMinutes : null;
  };
  const etas = db.plan.vehicles
    .map(etaMinutesOf)
    .filter((x): x is number => x !== null);
  const etaSpread = etas.length >= 2 ? Math.max(...etas) - Math.min(...etas) : 0;
  const etaOutOfWindow = etaSpread > ETA_WINDOW;

  // ---- mutations ----
  /** Pull a person out of wherever they currently sit (pool/driver/passenger). */
  function detach(d: MockDb, email: string) {
    // dragging out a driver dissolves their vehicle; its passengers fall to pool
    d.plan.vehicles = d.plan.vehicles.filter((v) => v.driverEmail !== email);
    for (const v of d.plan.vehicles) {
      v.passengers = v.passengers.filter((p) => p.email !== email);
    }
  }

  function makeVehicle(email: string) {
    update((d) => {
      detach(d, email);
      const saved = d.vehicles.find((v) => v.email === email);
      // Seed the start point (first pickup) from the driver's own start location.
      const pref = d.prefs.find((p) => p.email === email);
      d.plan.vehicles.push({
        id: uid("v"),
        driverEmail: email,
        type: saved?.type ?? "car",
        label: saved?.label ?? "",
        capacity: saved?.capacity ?? 4,
        routeUrl: "",
        travelMinutes: 0,
        pickups: [
          { id: uid("pk"), label: pref?.startLocation.trim() ?? "", time: "", mapsUrl: pref?.startMapsUrl.trim() ?? "" },
        ],
        passengers: [],
      });
    });
  }

  /** Seat a person in a car with no pickup chosen yet. */
  function seatInVehicle(vehicleId: string, email: string) {
    update((d) => {
      const v = d.plan.vehicles.find((x) => x.id === vehicleId);
      if (!v || v.driverEmail === email) return;
      detach(d, email);
      const target = d.plan.vehicles.find((x) => x.id === vehicleId);
      if (target) target.passengers.push({ email, pickupId: null });
    });
  }

  /** Seat a person directly at a specific pickup point. */
  function seatAtPickup(vehicleId: string, pickupId: string, email: string) {
    update((d) => {
      const v = d.plan.vehicles.find((x) => x.id === vehicleId);
      if (!v || v.driverEmail === email) return;
      detach(d, email);
      const target = d.plan.vehicles.find((x) => x.id === vehicleId);
      if (target) target.passengers.push({ email, pickupId });
    });
  }

  function addPickup(vehicleId: string) {
    update((d) => {
      const v = d.plan.vehicles.find((x) => x.id === vehicleId);
      if (v) v.pickups.push({ id: uid("pk"), label: "", time: "", mapsUrl: "" });
    });
  }

  function editPickup(
    vehicleId: string,
    pickupId: string,
    field: "label" | "time" | "mapsUrl",
    value: string,
  ) {
    update((d) => {
      const pk = d.plan.vehicles
        .find((x) => x.id === vehicleId)
        ?.pickups.find((x) => x.id === pickupId);
      if (pk) pk[field] = value;
    });
  }

  function removePickup(vehicleId: string, pickupId: string) {
    update((d) => {
      const v = d.plan.vehicles.find((x) => x.id === vehicleId);
      if (!v || v.pickups[0]?.id === pickupId) return; // never the start point
      v.pickups = v.pickups.filter((pk) => pk.id !== pickupId);
      // people who were here fall back to "in the car, pickup TBD"
      v.passengers.forEach((p) => {
        if (p.pickupId === pickupId) p.pickupId = null;
      });
    });
  }

  /** Admin fills/edits someone's form → marks it admin-entered + unconfirmed. */
  function savePrefAsAdmin(email: string, data: Omit<Pref, "email" | "enteredBy" | "confirmed">) {
    update((d) => {
      const next: Pref = { email, ...data, enteredBy: "admin", confirmed: false };
      const existing = d.prefs.findIndex((p) => p.email === email);
      if (existing >= 0) d.prefs[existing] = next;
      else d.prefs.push(next);
    });
    setFormEmail(null);
  }

  function toPool(email: string) {
    update((d) => detach(d, email));
  }

  function removeVehicle(vehicleId: string) {
    update((d) => {
      d.plan.vehicles = d.plan.vehicles.filter((v) => v.id !== vehicleId);
    });
  }

  function setCapacity(vehicleId: string, capacity: number) {
    update((d) => {
      const v = d.plan.vehicles.find((x) => x.id === vehicleId);
      if (v) v.capacity = Math.max(1, capacity || 1);
    });
  }

  function setRouteUrl(vehicleId: string, value: string) {
    update((d) => {
      const v = d.plan.vehicles.find((x) => x.id === vehicleId);
      if (v) v.routeUrl = value;
    });
  }

  function setTravelMinutes(vehicleId: string, minutes: number) {
    update((d) => {
      const v = d.plan.vehicles.find((x) => x.id === vehicleId);
      if (v) v.travelMinutes = Math.max(0, minutes);
    });
  }

  // ---- event-wide stops + destination ----
  function addStop() {
    update((d) => {
      d.plan.stops.push({ id: uid("s"), label: "", mapsUrl: "", time: "" });
    });
  }
  function editStop(id: string, field: "label" | "mapsUrl" | "time", value: string) {
    update((d) => {
      const s = d.plan.stops.find((x) => x.id === id);
      if (s) s[field] = value;
    });
  }
  function removeStop(id: string) {
    update((d) => {
      d.plan.stops = d.plan.stops.filter((x) => x.id !== id);
    });
  }
  function editDestination(field: "label" | "mapsUrl" | "time" | "notes", value: string) {
    update((d) => {
      d.plan.destination[field] = value;
    });
  }

  // ---- drag glue ----
  const onDragStart = (email: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_KEY, email);
    e.dataTransfer.effectAllowed = "move";
  };
  const allowDrop = (zone: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragOver !== zone) setDragOver(zone);
  };
  const getEmail = (e: React.DragEvent) => e.dataTransfer.getData(DRAG_KEY);

  // ---- WhatsApp export ----
  const hasDestination = destinationSet(db.plan.destination);

  // Shared header (trailhead + common stops), used by both the full and compact text.
  const planHeaderLines = (): string[] => {
    const out: string[] = [];
    const dest = db.plan.destination;
    const destLine = [dest.label, dest.mapsUrl].filter(Boolean).join(" - ");
    if (destLine) {
      out.push(`*Trailhead:* ${destLine}${dest.time ? ` (reach by ${to12h(dest.time)})` : ""}`);
      if (dest.notes) out.push(dest.notes);
      out.push("");
    }
    if (db.plan.stops.length) {
      out.push("Stops along the way:");
      db.plan.stops.forEach((s) =>
        out.push(`${s.label}${s.time ? ` - ${to12h(s.time)}` : ""}${s.mapsUrl ? ` - ${s.mapsUrl}` : ""}`),
      );
      out.push("");
    }
    return out;
  };

  const carHeaderLine = (v: PlanVehicle): string => {
    const driver = personByEmail(v.driverEmail);
    const total = occupants(v);
    const dur = formatDuration(v.travelMinutes);
    return `*${firstName(driver?.name)}'s car* (${total} ${total === 1 ? "person" : "people"}${dur ? `, ${dur}` : ""}) route: ${v.routeUrl}`;
  };

  const whatsapp = (): string => {
    const lines: string[] = ["Here's the transport plan:", "", ...planHeaderLines()];

    // Pickup points get sequential letters (A, B, C…) across all cars.
    let letterIdx = 0;
    const nextLetter = () => String.fromCharCode(65 + letterIdx++);

    db.plan.vehicles.forEach((v) => {
      const driver = personByEmail(v.driverEmail);
      lines.push(carHeaderLine(v));
      lines.push("");

      // pickup lines, lettered
      const letterOf: Record<string, string> = {};
      v.pickups.forEach((pk, i) => {
        const letter = nextLetter();
        letterOf[pk.id] = letter;
        const kind = i === 0 ? "Start" : "Pickup";
        const inner = [to12h(pk.time), pk.label].filter(Boolean).join(" - ");
        lines.push(
          `${kind} *${letter}*${inner ? ` - *${inner}*` : ""}${pk.mapsUrl ? ` - ${pk.mapsUrl}` : ""}`,
        );
      });
      lines.push("");

      // who's at each letter (the Start letter includes the driver)
      v.pickups.forEach((pk, i) => {
        const names: string[] = [];
        if (i === 0 && driver) names.push(firstName(driver.name));
        v.passengers
          .filter((p) => p.pickupId === pk.id)
          .forEach((p) => names.push(firstName(personByEmail(p.email)?.name)));
        if (names.length) lines.push(`${letterOf[pk.id]} (${names.length}): ${names.join(", ")}`);
      });
      const tbd = v.passengers.filter((p) => p.pickupId === null);
      if (tbd.length) {
        lines.push(
          `Pickup TBD (${tbd.length}): ${tbd.map((p) => firstName(personByEmail(p.email)?.name)).join(", ")}`,
        );
      }
      lines.push("");
    });

    // Anyone not in a car, by reported mode (kept so nobody's dropped silently).
    const modeOf = (email: string) => db.prefs.find((p) => p.email === email)?.travelMode;
    const needRide = pool.filter((p) => {
      const m = modeOf(p.email);
      return m === "needs_pickup" || m === undefined;
    });
    const ownWay = pool.filter((p) => {
      const m = modeOf(p.email);
      return m === "self_arranged" || m === "own_vehicle";
    });
    const startTextOf = (email: string) => {
      const pr = db.prefs.find((p) => p.email === email);
      return pr?.startLocation.trim() || pr?.startMapsUrl.trim() || "";
    };
    if (needRide.length) lines.push(`Still need a ride: ${needRide.map((p) => firstName(p.name)).join(", ")}`);
    if (ownWay.length)
      lines.push(
        `Coming on their own: ${ownWay
          .map((p) => {
            const s = startTextOf(p.email);
            return s ? `${firstName(p.name)} from ${s}` : firstName(p.name);
          })
          .join(", ")}`,
      );
    if (needRide.length || ownWay.length) lines.push("");

    lines.push("Please check if your pickup point makes sense and react to the message if it does.");
    return lines.join("\n").trim();
  };

  // Compact: just trailhead + common stops + each car with its route (no pickups/people).
  const whatsappCompact = (): string => {
    const lines: string[] = ["Here's the transport plan:", "", ...planHeaderLines()];
    db.plan.vehicles.forEach((v) => lines.push(carHeaderLine(v)));
    return lines.join("\n").trim();
  };

  // a passenger row inside a pickup / TBD list
  const renderPax = (email: string) => {
    const p = personByEmail(email);
    return (
      <li
        key={email}
        className="flex items-start justify-between gap-2 rounded bg-stone-50 px-2 py-1.5"
      >
        <div className="min-w-0">
          <span
            draggable
            onDragStart={onDragStart(email)}
            className="flex cursor-grab flex-wrap items-center gap-1 text-sm font-medium"
          >
            {p?.name ?? email}
            <NoteButton note={notesFor(email)} />
            <StatusPill status={statusFor(email)} />
            <FormButton status={statusFor(email)} onClick={() => setFormEmail(email)} />
          </span>
          <StartLine start={startFor(email)} />
          <Contact email={p?.email} phone={p?.phone} />
        </div>
        <button
          onClick={() => toPool(email)}
          title="remove from car"
          className="shrink-0 text-xs text-stone-400 hover:text-rose-600"
        >
          ✕
        </button>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ---- toolbar ---- */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 pt-3">
          <Breadcrumbs trail={[{ label: "Mockups", to: "/mockups" }, { label: "Carpool planner" }]} />
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Mockup · Carpool planner
            </p>
            <h1 className="text-xl font-bold text-stone-900">{db.event.title}</h1>
            <p className="text-sm text-stone-500">
              {db.event.date} · {db.event.location}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              to="/mockups"
              className="rounded-md px-2 py-1.5 text-stone-500 hover:text-stone-900"
            >
              ☰ All
            </Link>
            <Link
              to="/mockups/transport/plan"
              className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
            >
              📋 Full plan
            </Link>
            <Link
              to="/mockups/transport/me"
              className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
            >
              🧍 Hiker view
            </Link>
            <Link
              to="/mockups/transport/form"
              className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
            >
              📝 Travel form
            </Link>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
              schema v{SCHEMA_VERSION}
            </span>
            <button
              onClick={() => exportDb(db)}
              className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
            >
              ⭳ Export JSON
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
            >
              ⭱ Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setDb(await importDb(file));
                } catch (err) {
                  alert((err as Error).message);
                }
                e.target.value = "";
              }}
            />
            <button
              onClick={() => {
                if (confirm("Wipe localStorage and reseed?")) setDb(resetDb());
              }}
              className="rounded-md border border-rose-200 px-3 py-1.5 text-rose-600 hover:bg-rose-50"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* ---- stats ---- */}
      <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6 pt-5 text-sm">
        <span className="rounded-full bg-stone-200 px-3 py-1">{db.people.length} people</span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{seatsTotal} seats</span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{pool.length} unassigned</span>
        {overflow > 0 && (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">{overflow} overflow</span>
        )}
      </div>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-6 lg:grid-cols-[300px_1fr]">
        {/* ===================== PEOPLE POOL (drag source + unassign target) ===================== */}
        <section
          onDragOver={allowDrop("pool")}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            const email = getEmail(e);
            if (email) toPool(email);
            setDragOver(null);
          }}
          className={`h-fit rounded-xl border bg-white p-3 transition ${
            dragOver === "pool" ? "border-stone-900 ring-2 ring-stone-900/10" : "border-stone-200"
          }`}
        >
          <h2 className="mb-2 px-1 text-sm font-semibold text-stone-700">
            People ({pool.length})
          </h2>
          <p className="mb-3 px-1 text-xs text-stone-400">
            Drag onto the zone → makes them a driver. Drag into a car → passenger.
            Drag back here → unassign.
          </p>
          <div className="flex flex-col gap-2">
            <PoolGroup
              label="Has a vehicle"
              tone="text-emerald-600"
              people={poolDrivers}
              savedVehicleFor={savedVehicleFor}
              statusFor={statusFor}
              notesFor={notesFor}
              startFor={startFor}
              onDragStart={onDragStart}
              onEditForm={setFormEmail}
            />
            <PoolGroup
              label="Hasn't filled the form"
              tone="text-amber-600"
              people={poolNoForm}
              savedVehicleFor={savedVehicleFor}
              statusFor={statusFor}
              notesFor={notesFor}
              startFor={startFor}
              onDragStart={onDragStart}
              onEditForm={setFormEmail}
            />
            <PoolGroup
              label="Filled — needs a ride"
              tone="text-stone-400"
              people={poolRiders}
              savedVehicleFor={savedVehicleFor}
              statusFor={statusFor}
              notesFor={notesFor}
              startFor={startFor}
              onDragStart={onDragStart}
              onEditForm={setFormEmail}
            />
            {pool.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-stone-300">
                everyone's in a car 🎉
              </p>
            )}
          </div>
        </section>

        {/* ===================== VEHICLES ===================== */}
        <section className="space-y-4">
          {/* WhatsApp text — needs a trailhead */}
          {!hasDestination ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Set the 🏁 trailhead below to generate the WhatsApp text.
            </p>
          ) : (
            db.plan.vehicles.length > 0 && (
              <div className="space-y-2">
                <details className="rounded-xl border border-stone-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-stone-600">
                    📋 WhatsApp text (full)
                  </summary>
                  <textarea
                    readOnly
                    rows={Math.max(8, db.plan.vehicles.length * 3 + db.plan.stops.length)}
                    value={whatsapp()}
                    className="mt-2 w-full rounded border border-stone-200 p-2 font-mono text-xs text-stone-700"
                  />
                </details>
                <details className="rounded-xl border border-stone-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-stone-600">
                    🗜️ WhatsApp text (compact — cars, routes &amp; common stops)
                  </summary>
                  <textarea
                    readOnly
                    rows={Math.max(6, db.plan.vehicles.length + db.plan.stops.length + 4)}
                    value={whatsappCompact()}
                    className="mt-2 w-full rounded border border-stone-200 p-2 font-mono text-xs text-stone-700"
                  />
                </details>
              </div>
            )
          )}

          {/* new-vehicle dropzone */}
          <div
            onDragOver={allowDrop("new")}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const email = getEmail(e);
              if (email) makeVehicle(email);
              setDragOver(null);
            }}
            className={`flex items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${
              dragOver === "new"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-stone-300 text-stone-400"
            }`}
          >
            ＋ Drop a person here to start a new vehicle (they become the driver)
          </div>

          {db.plan.vehicles.length === 0 && (
            <p className="text-sm text-stone-400">No vehicles yet. Drag a driver up there ↑</p>
          )}

          {etaOutOfWindow && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              ⚠️ Cars are arriving more than {ETA_WINDOW} min apart (spread {etaSpread} min).
              Nudge start or travel times so everyone reaches around the same time.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {db.plan.vehicles.map((v) => {
              const driver = personByEmail(v.driverEmail);
              const occ = occupants(v);
              const over = occ > v.capacity;
              return (
                <div
                  key={v.id}
                  onDragOver={allowDrop(v.id)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const email = getEmail(e);
                    if (email) seatInVehicle(v.id, email);
                    setDragOver(null);
                  }}
                  className={`rounded-xl border bg-white shadow-sm transition ${
                    over
                      ? "border-rose-300"
                      : dragOver === v.id
                        ? "border-stone-900 ring-2 ring-stone-900/10"
                        : "border-stone-200"
                  }`}
                >
                  {/* driver header */}
                  <div className="flex items-start justify-between gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <div
                        draggable
                        onDragStart={onDragStart(v.driverEmail)}
                        className="cursor-grab"
                        title="drag to move / dissolve this vehicle"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                          {VEHICLE_ICON[v.type]} Driving
                        </p>
                        <p className="flex flex-wrap items-center gap-1 font-semibold leading-tight">
                          {driver?.name ?? "?"}
                          <NoteButton note={notesFor(v.driverEmail)} />
                          <StatusPill status={statusFor(v.driverEmail)} />
                          <FormButton
                            status={statusFor(v.driverEmail)}
                            onClick={() => setFormEmail(v.driverEmail)}
                          />
                        </p>
                        <p className="text-xs text-stone-500">{v.label || "—"}</p>
                      </div>
                      <Contact email={driver?.email} phone={driver?.phone} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          over
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {occ}/{v.capacity} seats
                      </span>
                      <button
                        onClick={() => removeVehicle(v.id)}
                        className="text-xs text-stone-300 hover:text-rose-600"
                      >
                        remove
                      </button>
                    </div>
                  </div>

                  {/* visual seat meter — driver seat is clearly theirs */}
                  <div className="border-b border-stone-100 px-3 py-2.5">
                    <SeatMeter
                      capacity={v.capacity}
                      passengers={v.passengers.length}
                      driverName={driver?.name}
                    />
                  </div>

                  {/* capacity */}
                  <div className="flex items-center gap-2 px-3 pt-2 text-xs text-stone-500">
                    <span>Seats</span>
                    <input
                      type="number"
                      min={1}
                      value={v.capacity}
                      onChange={(e) => setCapacity(v.id, Number(e.target.value))}
                      className="w-14 rounded border border-stone-300 px-1.5 py-0.5"
                    />
                    <span className="text-stone-400">incl. driver</span>
                  </div>

                  {/* full route link */}
                  <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-stone-500">
                    <span className="shrink-0">Route</span>
                    <input
                      value={v.routeUrl}
                      onChange={(e) => setRouteUrl(v.id, e.target.value)}
                      placeholder="full route — Google Maps link"
                      className="min-w-0 flex-1 rounded border border-stone-300 px-1.5 py-0.5"
                    />
                    {v.routeUrl.trim() && (
                      <a
                        href={v.routeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-blue-600 hover:underline"
                      >
                        open ↗
                      </a>
                    )}
                  </div>

                  {/* travel time → ETA (start time + travel time) */}
                  <div className="flex items-center gap-2 px-3 pb-2 text-xs text-stone-500">
                    <span className="shrink-0">Travel time</span>
                    <TravelTimeInput
                      minutes={v.travelMinutes}
                      onChange={(m) => setTravelMinutes(v.id, m)}
                    />
                    <span className="shrink-0 text-stone-400">→ ETA</span>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 font-mono ${
                        etaOutOfWindow && etaMinutesOf(v) !== null
                          ? "bg-rose-100 font-semibold text-rose-700"
                          : "bg-stone-100"
                      }`}
                      title={etaMinutesOf(v) === null ? "set the start time on the START pickup" : undefined}
                    >
                      {etaClockOf(v) || "—"}
                    </span>
                  </div>

                  {/* pickup points — each its own block; [0] is the start point */}
                  <div className="space-y-2 px-3 pb-3">
                    {v.pickups.map((pk, i) => {
                      const here = v.passengers.filter((p) => p.pickupId === pk.id);
                      const isStart = i === 0;
                      return (
                        <div
                          key={pk.id}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragOver !== pk.id) setDragOver(pk.id);
                          }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const email = getEmail(e);
                            if (email) seatAtPickup(v.id, pk.id, email);
                            setDragOver(null);
                          }}
                          className={`rounded-lg border px-2.5 py-2 transition ${
                            dragOver === pk.id
                              ? "border-stone-900 ring-2 ring-stone-900/10"
                              : isStart
                                ? "border-emerald-300 bg-emerald-50/50"
                                : "border-stone-200 bg-white"
                          }`}
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                isStart ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-600"
                              }`}
                            >
                              {isStart ? "Start" : `Pickup ${i}`}
                            </span>
                            <input
                              type="time"
                              value={pk.time}
                              onChange={(e) => editPickup(v.id, pk.id, "time", e.target.value)}
                              className="w-[84px] shrink-0 rounded border border-stone-300 px-1 py-0.5 text-xs"
                            />
                            <input
                              value={pk.label}
                              onChange={(e) => editPickup(v.id, pk.id, "label", e.target.value)}
                              placeholder={isStart ? "start location" : "pickup location"}
                              className="min-w-0 flex-1 rounded border border-stone-300 px-1.5 py-0.5 text-xs"
                            />
                            {!isStart && (
                              <button
                                onClick={() => removePickup(v.id, pk.id)}
                                title="remove pickup"
                                className="shrink-0 text-sm text-stone-300 hover:text-rose-600"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                          <div className="mb-1.5 flex items-center gap-1">
                            <input
                              value={pk.mapsUrl}
                              onChange={(e) => editPickup(v.id, pk.id, "mapsUrl", e.target.value)}
                              placeholder="maps link (optional)"
                              className="min-w-0 flex-1 rounded border border-stone-200 px-1.5 py-0.5 text-xs"
                            />
                            {pk.mapsUrl.trim() && (
                              <a
                                href={pk.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-xs text-blue-600 hover:underline"
                              >
                                open ↗
                              </a>
                            )}
                          </div>
                          <ul className="space-y-1">
                            {here.map((p) => renderPax(p.email))}
                            {here.length === 0 && (
                              <li className="px-1 py-0.5 text-[11px] text-stone-300">
                                {isStart ? "starts here · drag others to add" : "drag someone here"}
                              </li>
                            )}
                          </ul>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => addPickup(v.id)}
                      className="w-full rounded-lg border border-dashed border-stone-300 px-2 py-1.5 text-xs text-stone-500 hover:bg-stone-50"
                    >
                      + Add pickup point
                    </button>

                    {/* in the car, pickup not chosen yet */}
                    {(() => {
                      const tbd = v.passengers.filter((p) => p.pickupId === null);
                      if (tbd.length === 0) return null;
                      return (
                        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-2.5 py-2">
                          <p className="mb-1 text-[10px] font-bold uppercase text-amber-600">
                            In the car · pickup TBD
                          </p>
                          <ul className="space-y-1">{tbd.map((p) => renderPax(p.email))}</ul>
                        </div>
                      );
                    })()}

                    {v.passengers.length === 0 && (
                      <p className="rounded border border-dashed border-stone-200 px-2 py-2 text-center text-xs text-stone-300">
                        drop people on the car (pickup TBD) or onto a pickup point
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* destination (trailhead) — required */}
          <div
            className={`rounded-xl border p-3 ${
              hasDestination ? "border-stone-200 bg-white" : "border-rose-300 bg-rose-50"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                🏁 Trailhead
              </span>
              {!hasDestination && (
                <span className="text-xs font-medium text-rose-600">required to generate the plan</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={db.plan.destination.label}
                onChange={(e) => editDestination("label", e.target.value)}
                placeholder="trailhead name (e.g. Anthargange base)"
                className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
              />
              <input
                type="time"
                value={db.plan.destination.time}
                onChange={(e) => editDestination("time", e.target.value)}
                title="reach by"
                className="w-[100px] rounded border border-stone-300 px-1 py-1 text-sm"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={db.plan.destination.mapsUrl}
                onChange={(e) => editDestination("mapsUrl", e.target.value)}
                placeholder="Google Maps link"
                className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-xs"
              />
              {db.plan.destination.mapsUrl.trim() && (
                <a
                  href={db.plan.destination.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-blue-600 hover:underline"
                >
                  open ↗
                </a>
              )}
            </div>
            <textarea
              value={db.plan.destination.notes}
              onChange={(e) => editDestination("notes", e.target.value)}
              rows={2}
              placeholder="notes — parking, entry fee, what to carry…"
              className="mt-2 w-full rounded border border-stone-300 px-2 py-1 text-xs"
            />
          </div>

          {/* extra stops along the way (event-wide) */}
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">Extra stops</h3>
              <button
                onClick={addStop}
                className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100"
              >
                + Add stop
              </button>
            </div>
            {db.plan.stops.length === 0 ? (
              <p className="text-xs text-stone-400">
                Food, fuel, a lake detour — for the whole group.
              </p>
            ) : (
              <div className="space-y-2">
                {db.plan.stops.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 px-2 py-1.5"
                  >
                    <input
                      value={s.label}
                      onChange={(e) => editStop(s.id, "label", e.target.value)}
                      placeholder="label (e.g. Breakfast — Maddur Tiffanys)"
                      className="min-w-0 flex-1 rounded border border-stone-300 px-1.5 py-0.5 text-xs"
                    />
                    <input
                      type="time"
                      value={s.time}
                      onChange={(e) => editStop(s.id, "time", e.target.value)}
                      className="w-[84px] shrink-0 rounded border border-stone-300 px-1 py-0.5 text-xs"
                    />
                    <input
                      value={s.mapsUrl}
                      onChange={(e) => editStop(s.id, "mapsUrl", e.target.value)}
                      placeholder="maps link"
                      className="min-w-0 flex-1 rounded border border-stone-200 px-1.5 py-0.5 text-xs"
                    />
                    <button
                      onClick={() => removeStop(s.id)}
                      title="remove stop"
                      className="shrink-0 text-sm text-stone-300 hover:text-rose-600"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {formEmail && (
        <AdminFormModal
          person={personByEmail(formEmail)}
          pref={prefFor(formEmail)}
          onSave={(data) => savePrefAsAdmin(formEmail, data)}
          onClose={() => setFormEmail(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
type FormStatus = "none" | "unconfirmed" | "ok";

function PoolGroup({
  label,
  tone,
  people,
  savedVehicleFor,
  statusFor,
  notesFor,
  startFor,
  onDragStart,
  onEditForm,
}: {
  label: string;
  tone: string;
  people: Person[];
  savedVehicleFor: (email: string) => SavedVehicle | undefined;
  statusFor: (email: string) => FormStatus;
  notesFor: (email: string) => string;
  startFor: (email: string) => { label: string; mapsUrl: string };
  onDragStart: (email: string) => (e: React.DragEvent) => void;
  onEditForm: (email: string) => void;
}) {
  if (people.length === 0) return null;
  return (
    <>
      <p className={`mt-1 px-1 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
        {label} ({people.length})
      </p>
      {people.map((p) => (
        <PersonChip
          key={p.email}
          person={p}
          vehicle={savedVehicleFor(p.email)}
          status={statusFor(p.email)}
          note={notesFor(p.email)}
          start={startFor(p.email)}
          onDragStart={onDragStart(p.email)}
          onEditForm={() => onEditForm(p.email)}
        />
      ))}
    </>
  );
}

function PersonChip({
  person,
  vehicle,
  status,
  note,
  start,
  onDragStart,
  onEditForm,
}: {
  person: Person;
  vehicle: SavedVehicle | undefined;
  status: FormStatus;
  note: string;
  start: { label: string; mapsUrl: string };
  onDragStart: (e: React.DragEvent) => void;
  onEditForm: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="cursor-grab rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm hover:border-stone-300 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-900">{person.name}</p>
          <StartLine start={start} />
          <Contact email={person.email} phone={person.phone} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {vehicle && (
            <span
              className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
              title={`Has a vehicle: ${vehicle.capacity} seats`}
            >
              {VEHICLE_ICON[vehicle.type]} {vehicle.capacity}
            </span>
          )}
          <StatusPill status={status} />
          <NoteButton note={note} />
          <FormButton status={status} onClick={onEditForm} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: FormStatus }) {
  if (status === "none")
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
        no form
      </span>
    );
  if (status === "unconfirmed")
    return (
      <span
        className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700"
        title="Admin-filled — waiting for the person to confirm"
      >
        unconfirmed
      </span>
    );
  return null;
}

/** Admin "fill / edit this person's form" pencil. */
function FormButton({ status, onClick }: { status: FormStatus; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={status === "none" ? "Fill this person's form" : "Edit this person's form"}
      className="leading-none text-stone-300 hover:text-stone-700"
    >
      ✎
    </button>
  );
}

/**
 * Draws the vehicle's seats as pips so it's obvious the driver occupies one:
 * [driver-initial] [rider] [rider] [empty] … (+ red pips if over capacity).
 */
function SeatMeter({
  capacity,
  passengers,
  driverName,
}: {
  capacity: number;
  passengers: number;
  driverName?: string;
}) {
  const riderSeats = Math.max(0, capacity - 1); // capacity includes the driver
  const filled = Math.min(passengers, riderSeats);
  const empty = Math.max(0, riderSeats - passengers);
  const over = Math.max(0, passengers - riderSeats);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <span
          title={`${driverName ?? "Driver"} — driver (1 seat)`}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white"
        >
          {(driverName?.[0] ?? "D").toUpperCase()}
        </span>
        {Array.from({ length: filled }).map((_, i) => (
          <span key={`f${i}`} title="rider" className="h-6 w-6 rounded-full bg-sky-400" />
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <span
            key={`e${i}`}
            title="empty seat"
            className="h-6 w-6 rounded-full border-2 border-dashed border-stone-300"
          />
        ))}
        {Array.from({ length: over }).map((_, i) => (
          <span key={`o${i}`} title="over capacity" className="h-6 w-6 rounded-full bg-rose-500" />
        ))}
      </div>
      <p className="text-[11px] text-stone-500">
        <span className="font-medium text-emerald-700">driving</span>
        {filled > 0 && ` · ${filled} rider${filled > 1 ? "s" : ""}`}
        {empty > 0 && ` · ${empty} seat${empty > 1 ? "s" : ""} free`}
        {over > 0 && (
          <span className="font-medium text-rose-600"> · {over} over capacity</span>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// order here = display order
const MODE_LABEL: Record<TravelMode, string> = {
  own_vehicle: "Car (have spots for others)",
  self_arranged: "Coming on my own",
  needs_pickup: "Need a ride",
};

function AdminFormModal({
  person,
  pref,
  onSave,
  onClose,
}: {
  person: Person | undefined;
  pref: Pref | undefined;
  onSave: (data: Omit<Pref, "email" | "enteredBy" | "confirmed">) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<TravelMode>(pref?.travelMode ?? "needs_pickup");
  const [start, setStart] = useState(pref?.startLocation ?? "");
  const [maps, setMaps] = useState(pref?.startMapsUrl ?? "");
  const [seats, setSeats] = useState(pref?.seatsOffered ?? 0);
  const [notes, setNotes] = useState(pref?.notes ?? "");
  const startOk = hasStart({ startLocation: start, startMapsUrl: maps });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-lg font-bold">Travel form · {person?.name ?? "?"}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>
        <p className="mb-4 text-xs text-amber-600">
          You're filling this on their behalf — they'll be asked to review &amp; confirm it.
        </p>

        <label className="block text-sm font-medium text-stone-700">How're you coming?</label>
        <div className="mt-1 mb-3 flex flex-col gap-1">
          {(Object.keys(MODE_LABEL) as TravelMode[]).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
              {MODE_LABEL[m]}
            </label>
          ))}
        </div>

        <label className="block text-sm font-medium text-stone-700">
          Start location <span className="font-normal text-stone-400">(name or maps link)</span>
        </label>
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="e.g. Koramangala"
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <div className="mb-1 mt-2 flex items-center gap-2">
          <input
            value={maps}
            onChange={(e) => setMaps(e.target.value)}
            placeholder="Google Maps link (optional)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          {maps.trim() && (
            <a href={maps} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-blue-600 hover:underline">
              open ↗
            </a>
          )}
        </div>
        {!startOk && (
          <p className="mb-3 text-xs text-rose-600">Add a start location name or a maps link.</p>
        )}

        {mode === "own_vehicle" && (
          <>
            <label className="block text-sm font-medium text-stone-700">Spare seats offered</label>
            <input
              type="number"
              min={0}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="mt-1 mb-3 w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </>
        )}

        <label className="block text-sm font-medium text-stone-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="anything the organisers should know"
          className="mt-1 mb-4 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100">
            Cancel
          </button>
          <button
            disabled={!startOk}
            onClick={() =>
              onSave({ travelMode: mode, startLocation: start, startMapsUrl: maps, seatsOffered: seats, notes })
            }
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save (unconfirmed)
          </button>
        </div>
      </div>
    </div>
  );
}

/** 📍 start location (name and/or maps link) for the person. */
function StartLine({ start }: { start: { label: string; mapsUrl: string } }) {
  const { label, mapsUrl } = start;
  if (!label.trim() && !mapsUrl.trim()) return null;
  return (
    <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-600">
      <span className="shrink-0">📍</span>
      {label.trim() ? (
        <span className="truncate">{label}</span>
      ) : (
        <span className="text-stone-400">pinned location</span>
      )}
      {mapsUrl.trim() && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-blue-600 hover:underline"
        >
          map ↗
        </a>
      )}
    </p>
  );
}

/** Travel-time input: type "2:30" or bare minutes ("45"). Parses on blur. */
function TravelTimeInput({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (m: number) => void;
}) {
  const [text, setText] = useState(minutesToHM(minutes));
  useEffect(() => setText(minutesToHM(minutes)), [minutes]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(hmToMinutes(text))}
      placeholder="2:30 or 45"
      className="w-20 rounded border border-stone-300 px-1.5 py-0.5"
    />
  );
}

/** email · phone-as-WhatsApp-link, shown for every person. */
function Contact({ email, phone }: { email?: string; phone?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-stone-400">
      {email && <span className="truncate">{email}</span>}
      {email && phone && <span>·</span>}
      <WhatsAppLink phone={phone} />
    </div>
  );
}

function WhatsAppLink({ phone }: { phone?: string }) {
  if (!phone) return null;
  const clean = phone.replace(/[\s+]/g, "");
  return (
    <a
      href={`https://wa.me/${clean}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="whitespace-nowrap text-emerald-600 hover:underline"
      title="Message on WhatsApp"
    >
      {phone} ↗
    </a>
  );
}

/** 📝 icon for a non-empty note; click to pop the note open (admin only). */
function NoteButton({ note }: { note?: string }) {
  const [open, setOpen] = useState(false);
  if (!note) return null;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        title="Has a note — click to read"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="leading-none text-amber-500 hover:text-amber-700"
      >
        📝
      </button>
      {open && (
        <span className="absolute right-0 top-6 z-20 w-52 rounded-lg border border-amber-200 bg-white p-2 text-left text-xs font-normal normal-case text-stone-700 shadow-lg">
          {note}
        </span>
      )}
    </span>
  );
}
