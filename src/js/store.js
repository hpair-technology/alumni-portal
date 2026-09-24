/* ============================================================================
   Firestore-backed stores with a localStorage fallback
   ----------------------------------------------------------------------------
   Each collection subscribes on its own. If a read is rejected (rules, network)
   the collection falls back to a copy in this browser and calls onDegraded so
   the page can say so. A failed write degrades only that collection, and
   `lastWriteLocal` lets a success message be honest about where it went.
   ========================================================================== */

import {
  doc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot,
  collection, query, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { toMillis } from "./util.js";

export const net = { degraded: false, reason: "", onDegraded: null };

function markDegraded(reason) {
  if (net.degraded) return;
  net.degraded = true;
  net.reason = reason || "";
  console.warn("[portal] degraded to local mode:", reason);
  try { net.onDegraded?.(reason); } catch (e) { console.error(e); }
}

const denied = (verb) => new Error(`You don't have permission to ${verb}.`);

export class Col {
  constructor(name, { orderField = "createdAt", dir = "desc", max = 400 } = {}) {
    Object.assign(this, { name, orderField, dir, max });
    this.items = [];
    this.listeners = new Set();
    this.unsub = null;
    this.mode = "remote";
    this.started = false;
    this.ready = false;
    this.lastWriteLocal = false;
  }
  get key() { return `hpair:${this.name}`; }

  onChange(fn) {
    this.listeners.add(fn);
    if (this.ready) fn(this.items);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.ready = true;
    this.listeners.forEach((fn) => { try { fn(this.items); } catch (e) { console.error(e); } });
  }

  localRead() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; } }
  localWrite(a) { try { localStorage.setItem(this.key, JSON.stringify(a)); } catch (e) { console.warn("localStorage full", e); } }
  sortLocal(a) {
    if (!this.orderField) return a;
    const s = [...a].sort((x, y) => toMillis(y[this.orderField]) - toMillis(x[this.orderField]));
    return this.dir === "asc" ? s.reverse() : s;
  }

  start() {
    if (this.started) return;
    this.started = true;
    if (net.degraded) return this.goLocal("already degraded");
    try {
      const base = collection(db, this.name);
      const qy = this.orderField
        ? query(base, orderBy(this.orderField, this.dir), limit(this.max))
        : query(base, limit(this.max));
      this.unsub = onSnapshot(qy,
        (snap) => {
          this.mode = "remote";
          this.items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          this.emit();
        },
        (err) => this.goLocal(err));
    } catch (err) { this.goLocal(err); }
  }
  stop() {
    if (this.unsub) { this.unsub(); this.unsub = null; }
    this.started = false; this.ready = false; this.items = [];
  }

  goLocal(err, { global = true } = {}) {
    if (this.unsub) { this.unsub(); this.unsub = null; }
    this.mode = "local";
    if (global) markDegraded(err?.code || err?.message || String(err));
    else console.warn(this.name + ": write rejected, keeping it in this browser", err);
    const plain = (it) => ({ ...it, createdAt: toMillis(it.createdAt) || Date.now(), updatedAt: toMillis(it.updatedAt) || Date.now() });
    const merged = new Map(this.localRead().map((it) => [it.id, it]));
    this.items.forEach((it) => merged.set(it.id, plain(it)));
    const rows = [...merged.values()];
    this.localWrite(rows);
    this.items = this.sortLocal(rows);
    this.emit();
  }

  async add(data, id = null) {
    this.lastWriteLocal = false;
    if (this.mode === "remote") {
      try {
        const payload = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        if (id) { await setDoc(doc(db, this.name, id), payload); return id; }
        const r = await addDoc(collection(db, this.name), payload);
        return r.id;
      } catch (err) {
        // A permission error is a rules problem, not a connectivity one.
        // Surface it instead of quietly hoarding the write in this browser.
        if (err?.code === "permission-denied") throw denied("do that");
        this.goLocal(err, { global: false });
      }
    }
    this.lastWriteLocal = true;
    const newId = id || `loc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const arr = this.localRead().filter((x) => x.id !== newId);
    arr.push({ ...data, id: newId, createdAt: Date.now(), updatedAt: Date.now() });
    this.localWrite(arr);
    this.items = this.sortLocal(arr);
    this.emit();
    return newId;
  }

  async update(id, data) {
    this.lastWriteLocal = false;
    if (this.mode === "remote" && !String(id).startsWith("loc_")) {
      try { await updateDoc(doc(db, this.name, id), { ...data, updatedAt: serverTimestamp() }); return; }
      catch (err) {
        if (err?.code === "permission-denied") throw denied("change that");
        this.goLocal(err, { global: false });
      }
    }
    this.lastWriteLocal = true;
    const arr = this.localRead().map((x) => (x.id === id ? { ...x, ...data, updatedAt: Date.now() } : x));
    this.localWrite(arr);
    this.items = this.sortLocal(arr);
    this.emit();
  }

  async remove(id) {
    this.lastWriteLocal = false;
    if (this.mode === "remote" && !String(id).startsWith("loc_")) {
      try { await deleteDoc(doc(db, this.name, id)); return; }
      catch (err) {
        if (err?.code === "permission-denied") throw denied("delete that");
        this.goLocal(err, { global: false });
      }
    }
    this.lastWriteLocal = true;
    const arr = this.localRead().filter((x) => x.id !== id);
    this.localWrite(arr);
    this.items = this.sortLocal(arr);
    this.emit();
  }
}

/** A single Firestore document with the same local fallback behaviour. */
export class Docu {
  constructor(path, fallback = {}) {
    this.path = path; this.fallback = fallback;
    this.data = null; this.listeners = new Set();
    this.unsub = null; this.mode = "remote"; this.started = false;
  }
  get key() { return `hpair:${this.path.replace(/\//g, ":")}`; }
  onChange(fn) { this.listeners.add(fn); if (this.data) fn(this.data); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => { try { fn(this.data); } catch (e) { console.error(e); } }); }
  localRead() { try { return JSON.parse(localStorage.getItem(this.key)) || { ...this.fallback }; } catch { return { ...this.fallback }; } }

  start() {
    if (this.started) return;
    this.started = true;
    if (net.degraded) return this.goLocal("already degraded");
    const [c, d] = this.path.split("/");
    try {
      this.unsub = onSnapshot(doc(db, c, d),
        (snap) => { this.mode = "remote"; this.data = snap.exists() ? snap.data() : { ...this.fallback }; this.emit(); },
        (err) => this.goLocal(err));
    } catch (err) { this.goLocal(err); }
  }
  stop() { if (this.unsub) { this.unsub(); this.unsub = null; } this.started = false; this.data = null; }
  goLocal(err) {
    if (this.unsub) { this.unsub(); this.unsub = null; }
    this.mode = "local"; markDegraded(err?.code || err?.message || String(err));
    this.data = this.localRead(); this.emit();
  }
  async write(data) {
    if (this.mode === "remote") {
      const [c, d] = this.path.split("/");
      try { await setDoc(doc(db, c, d), { ...data, updatedAt: serverTimestamp() }, { merge: true }); return; }
      catch (err) {
        if (err?.code === "permission-denied") throw denied("change that");
        this.goLocal(err);
      }
    }
    this.data = { ...this.data, ...data };
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch {}
    this.emit();
  }
}
