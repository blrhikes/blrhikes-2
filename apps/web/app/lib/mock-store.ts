// ---------------------------------------------------------------------------
// Mock store for the events/transport UI mockups.
//
// No backend yet — everything lives in localStorage. Bump SCHEMA_VERSION when
// the shape changes and the next load auto-wipes + reseeds (so a stale blob from
// an older mock can never crash the UI). There's also a JSON export/import so you
// can snapshot a fiddled-with state and reload it later.
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 11;
const STORAGE_KEY = "blrhikes-mock-db";

export type VehicleType = "car" | "suv" | "van" | "motorbike" | "other";

export interface Person {
  email: string;
  name: string;
  phone: string;
}

/** A person's saved vehicle — cross-event memory of what they can drive. */
export interface SavedVehicle {
  email: string; // owner
  type: VehicleType;
  label: string;
  capacity: number; // total seats incl. driver/rider
}

/** A stop on a vehicle's route. pickups[0] is the start point (driver's origin). */
export interface PlanPickup {
  id: string;
  label: string;
  time: string; // HH:MM
  mapsUrl: string;
}

/** A seated passenger. pickupId null = in the car, pickup not chosen yet. */
export interface PlanPassenger {
  email: string;
  pickupId: string | null;
}

/** One vehicle in the admin's carpool plan (the grouping decision). */
export interface PlanVehicle {
  id: string;
  driverEmail: string;
  type: VehicleType;
  label: string;
  capacity: number; // snapshot — admin can override per trip
  routeUrl: string;
  travelMinutes: number; // drive time for the full route; ETA = start time + this
  pickups: PlanPickup[]; // [0] = start point; driver begins here
  passengers: PlanPassenger[];
}

export type TravelMode = "own_vehicle" | "needs_pickup" | "self_arranged";

/**
 * A person's travel form for this event. Presence = "filled".
 * `enteredBy: 'admin'` + `confirmed: false` = the admin filled it on their behalf
 * and the person hasn't reviewed it yet.
 */
export interface Pref {
  email: string;
  travelMode: TravelMode;
  startLocation: string; // free-text name; one of this / startMapsUrl is required
  startMapsUrl: string; // optional Google Maps link
  seatsOffered: number;
  notes: string;
  enteredBy: "self" | "admin";
  confirmed: boolean;
}

/** A start is valid if it has a name OR a maps link. */
export function hasStart(p: { startLocation: string; startMapsUrl: string }): boolean {
  return !!(p.startLocation.trim() || p.startMapsUrl.trim());
}

/** An event-wide stop along the way (not tied to any vehicle). */
export interface PlanStop {
  id: string;
  label: string; // free text (restaurant name, "Breakfast — Maddur Tiffanys", etc.)
  mapsUrl: string;
  time: string;
}

/** The shared destination — the trailhead everyone's heading to. */
export interface PlanDestination {
  label: string;
  mapsUrl: string;
  time: string;
  notes: string;
}

export interface MockDb {
  __version: number;
  event: { id: string; title: string; date: string; location: string };
  people: Person[];
  vehicles: SavedVehicle[]; // saved vehicles keyed by owner email
  prefs: Pref[]; // who filled the transport form (+ notes). Absent = not filled.
  plan: { vehicles: PlanVehicle[]; stops: PlanStop[]; destination: PlanDestination };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
function seed(): MockDb {
  return {
    __version: SCHEMA_VERSION,
    event: {
      id: "evt_hike",
      title: "Weekend Hike",
      date: "2026-06-14",
      location: "TBD",
    },
    people: [
      { email: "radhika@example.com", name: "Radhika", phone: "+918141703431" },
      { email: "sandip@example.com", name: "Sandip Agarwal", phone: "+919711406757" },
      { email: "srilekha@example.com", name: "Srilekha", phone: "+919390099543" },
      { email: "dhanashree@example.com", name: "Dhanashree Pandit", phone: "+917798922384" },
      { email: "rahul@example.com", name: "Rahul A", phone: "+919008028998" },
      { email: "shrey@example.com", name: "Shrey Pandey", phone: "+919057261430" },
      { email: "anupama@example.com", name: "Anupama", phone: "+917204202924" },
      { email: "shreshth@example.com", name: "Shreshth", phone: "+918527116035" },
      { email: "aditi@example.com", name: "Aditi Arya", phone: "+918586040068" },
      { email: "sriharsha@example.com", name: "Sriharsha", phone: "+919059721905" },
      { email: "chandan@example.com", name: "Chandan", phone: "+918892955472" },
      { email: "sahana@example.com", name: "Sahana", phone: "+919047016296" },
      { email: "deepak@example.com", name: "Deepak", phone: "+917259740179" },
    ],
    // Vehicle owners: capacity = spare spots + 1 (the driver's own seat).
    vehicles: [
      { email: "rahul@example.com", type: "car", label: "", capacity: 5 },
      { email: "shrey@example.com", type: "car", label: "", capacity: 5 },
      { email: "chandan@example.com", type: "car", label: "", capacity: 3 },
    ],
    prefs: [
      { email: "radhika@example.com", travelMode: "needs_pickup", startLocation: "New Tipassandra (near Indiranagar)", startMapsUrl: "", seatsOffered: 0, notes: "", enteredBy: "self", confirmed: true },
      { email: "sandip@example.com", travelMode: "needs_pickup", startLocation: "JP Nagar 3rd phase, Mini forest", startMapsUrl: "", seatsOffered: 0, notes: "", enteredBy: "self", confirmed: true },
      { email: "srilekha@example.com", travelMode: "needs_pickup", startLocation: "5th block, Koramangala", startMapsUrl: "", seatsOffered: 0, notes: "Sri Harsha and I are starting from same location.", enteredBy: "self", confirmed: true },
      { email: "dhanashree@example.com", travelMode: "needs_pickup", startLocation: "AECS Layout, Brookefield.", startMapsUrl: "", seatsOffered: 0, notes: "", enteredBy: "self", confirmed: true },
      { email: "rahul@example.com", travelMode: "own_vehicle", startLocation: "Cooke Town", startMapsUrl: "", seatsOffered: 4, notes: "Partner TBC, will confirm Friday afternoon", enteredBy: "self", confirmed: true },
      { email: "shrey@example.com", travelMode: "own_vehicle", startLocation: "Usual", startMapsUrl: "", seatsOffered: 4, notes: "", enteredBy: "self", confirmed: true },
      { email: "anupama@example.com", travelMode: "needs_pickup", startLocation: "Indiranagar 80ft road", startMapsUrl: "", seatsOffered: 0, notes: "", enteredBy: "self", confirmed: true },
      { email: "shreshth@example.com", travelMode: "needs_pickup", startLocation: "HSR", startMapsUrl: "", seatsOffered: 0, notes: "", enteredBy: "self", confirmed: true },
      { email: "aditi@example.com", travelMode: "needs_pickup", startLocation: "JP Nagar", startMapsUrl: "", seatsOffered: 0, notes: "", enteredBy: "self", confirmed: true },
      { email: "sriharsha@example.com", travelMode: "needs_pickup", startLocation: "5th block, Koramangala", startMapsUrl: "", seatsOffered: 0, notes: "", enteredBy: "self", confirmed: true },
      { email: "chandan@example.com", travelMode: "own_vehicle", startLocation: "Esteem Mall", startMapsUrl: "", seatsOffered: 2, notes: "", enteredBy: "self", confirmed: true },
      { email: "sahana@example.com", travelMode: "needs_pickup", startLocation: "Indiranagar 80ft road", startMapsUrl: "", seatsOffered: 0, notes: "", enteredBy: "self", confirmed: true },
      { email: "deepak@example.com", travelMode: "needs_pickup", startLocation: "", startMapsUrl: "", seatsOffered: 0, notes: "", enteredBy: "self", confirmed: true },
    ],
    plan: {
      vehicles: [],
      stops: [],
      destination: { label: "", mapsUrl: "", time: "", notes: "" }, // trailhead — admin must set
    },
  };
}

/** The trailhead counts as set once it has a name or a maps link. */
export function destinationSet(d: PlanDestination): boolean {
  return !!(d.label.trim() || d.mapsUrl.trim());
}

// ---------------------------------------------------------------------------
// Time helpers (travel time + ETA)
// ---------------------------------------------------------------------------
/** "2:30" → 150, "45" (no colon) → 45 minutes. */
export function hmToMinutes(str: string): number {
  const s = (str ?? "").trim();
  if (!s) return 0;
  if (s.includes(":")) {
    const [h, m] = s.split(":");
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
  }
  return parseInt(s, 10) || 0;
}

/** 150 → "2:30". */
export function minutesToHM(mins: number): string {
  const n = Math.max(0, Math.round(mins) || 0);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

/** Add minutes to a "HH:MM" clock time → "HH:MM" (wraps a day). "" if no base time. */
export function addClock(hhmm: string, mins: number): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const t = (((h * 60 + m + (mins || 0)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

// Below this version the plan shape changed in a breaking way (pickups model);
// older blobs are wiped. At or above it, we backfill new fields and keep your
// data so a SCHEMA_VERSION bump for a *new field* never throws away your plan.
const MIN_COMPATIBLE_VERSION = 7;

export function loadDb(): MockDb {
  if (!hasStorage()) return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return persist(seed());
    const parsed = JSON.parse(raw) as { __version?: number };
    if (typeof parsed.__version !== "number" || parsed.__version < MIN_COMPATIBLE_VERSION) {
      return persist(seed()); // incompatible old shape → reseed
    }
    return persist(backfill(parsed)); // additive change → keep data, fill new fields
  } catch {
    return persist(seed());
  }
}

/** Add any fields introduced since the stored version, preserving existing data. */
function backfill(db: any): MockDb {
  db.plan ??= {};
  db.plan.vehicles ??= [];
  db.plan.stops ??= [];
  db.plan.destination ??= { label: "", mapsUrl: "", time: "", notes: "" };
  db.plan.destination.notes ??= "";

  // Repair id collisions from the old counter scheme (a reset counter re-issued
  // ids that already existed, so two vehicles/pickups could share an id).
  let n = 0;
  const fresh = (p: string) => `${p}_${Date.now().toString(36)}_${n++}`;
  const seenV = new Set<string>();
  for (const v of db.plan.vehicles) {
    v.routeUrl ??= "";
    v.travelMinutes ??= 0;
    v.pickups ??= [];
    v.passengers ??= [];
    if (seenV.has(v.id)) v.id = fresh("v"); // vehicle id is referenced by nothing else — safe to re-issue
    seenV.add(v.id);
    const seenPk = new Set<string>();
    for (const pk of v.pickups) {
      pk.mapsUrl ??= "";
      if (seenPk.has(pk.id)) pk.id = fresh("pk");
      seenPk.add(pk.id);
    }
  }

  // Merge in roster entries added to the seed since this blob was saved, without
  // touching existing people/prefs the admin may have edited. Additive only.
  const base = seed();
  db.people ??= [];
  db.prefs ??= [];
  db.vehicles ??= [];
  const havePerson = new Set(db.people.map((p: Person) => p.email));
  for (const p of base.people) if (!havePerson.has(p.email)) db.people.push(p);
  const havePref = new Set(db.prefs.map((p: Pref) => p.email));
  for (const pr of base.prefs) if (!havePref.has(pr.email)) db.prefs.push(pr);
  const haveVehicle = new Set(db.vehicles.map((v: SavedVehicle) => v.email));
  for (const sv of base.vehicles) if (!haveVehicle.has(sv.email)) db.vehicles.push(sv);

  return db as MockDb;
}

export function persist(db: MockDb): MockDb {
  if (hasStorage()) {
    db.__version = SCHEMA_VERSION;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
  return db;
}

export function resetDb(): MockDb {
  if (hasStorage()) window.localStorage.removeItem(STORAGE_KEY);
  return persist(seed());
}

// ---------------------------------------------------------------------------
// JSON export / import (save + load a localStorage snapshot)
// ---------------------------------------------------------------------------
export function exportDb(db: MockDb): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blrhikes-mock-${db.event.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDb(file: File): Promise<MockDb> {
  const text = await file.text();
  const parsed = JSON.parse(text) as MockDb;
  if (!parsed || !Array.isArray(parsed.people) || !parsed.plan) {
    throw new Error("That doesn't look like a mock-db export.");
  }
  return persist(parsed);
}
