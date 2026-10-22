"use strict";
/* MotoBike Parking at BU
 * ข้อมูลทั้งหมดผ่านชั้น `db` (localStorage) เพื่อให้เปลี่ยนเป็น REST/Firebase/Supabase ได้ภายหลังโดยแก้เฉพาะส่วนนี้ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ALLOWED_DOMAIN = "@bumail.net";
const EMAIL_RE = /^[^\s@]+@bumail\.net$/i;
const KEYS = { users: "motoParkUsers", session: "motoParkSession", zones: "motoParkZones", reports: "motoParkReports", data: (id) => `motoParkData:${id}` };
const HOLD_LATE_MS = 5 * 60 * 1000;
const MAX_CHECKINS = 3, MAX_REPORTS = 3;

const db = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage เต็มหรือถูกปิด */ } },
  del(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
};

/* ---------- โซนจอดมอเตอร์ไซค์ ---------- */
const ZONE_DEFS = [
  { id: "A", name: "ลานมอเตอร์ไซค์ ตึก A", short: "ตึก A", detail: "ใกล้คณะบริหารธุรกิจ", total: 220, start: 92, pos: "18%;46%" },
  { id: "P", name: "ลานมอเตอร์ไซค์ ตึกเพชร", short: "ตึกเพชร", detail: "อาคารเพชร", total: 160, start: 41, pos: "66%;43%" },
  { id: "C", name: "ลานมอเตอร์ไซค์ คณะนิเทศศาสตร์", short: "คณะนิเทศศาสตร์", detail: "Communication Arts", total: 140, start: 14, pos: "25%;68%" },
  { id: "F", name: "ลานมอเตอร์ไซค์ โรงอาหารกลาง", short: "โรงอาหารกลาง", detail: "Central Canteen", total: 260, start: 0, pos: "50%;67%" }
];
let zoneState = loadZones();
function loadZones() {
  const saved = db.get(KEYS.zones, null);
  const ok = saved && saved.spaces && ZONE_DEFS.every((z) => Number.isInteger(saved.spaces[z.id]));
  if (ok) return saved;
  const fresh = { spaces: Object.fromEntries(ZONE_DEFS.map((z) => [z.id, z.start])), updatedAt: Date.now() };
  db.set(KEYS.zones, fresh);
  return fresh;
}
function saveZones() { zoneState.updatedAt = Date.now(); db.set(KEYS.zones, zoneState); }
const zoneColor = (z) => (z.spaces === 0 ? "red" : z.spaces / z.total < 0.12 ? "yellow" : "green");
const zones = () => ZONE_DEFS.map((d) => ({ ...d, spaces: zoneState.spaces[d.id], color: zoneColor({ spaces: zoneState.spaces[d.id], total: d.total }) }));
const zoneById = (id) => zones().find((z) => z.id === id);
const adjustSpaces = (id, delta) => { const d = ZONE_DEFS.find((z) => z.id === id); zoneState.spaces[id] = Math.max(0, Math.min(d.total, zoneState.spaces[id] + delta)); saveZones(); };

/* ---------- รางวัล ---------- */
const REWARDS = [
  { id: "score10", name: "เพิ่ม Parking Score +10", desc: "ใช้ทันที (สูงสุด 100)", cost: 60 },
  { id: "hold30", name: "สิทธิ์ถือที่จอง 30 นาที", desc: "ใช้ตอนจอง 1 ครั้ง", cost: 40 },
  { id: "coffee", name: "คูปองกาแฟในมหาวิทยาลัย", desc: "แสดงรหัสที่ร้านพันธมิตร", cost: 80 },
  { id: "wash", name: "ส่วนลดล้างรถมอเตอร์ไซค์ 20%", desc: "แสดงรหัสที่ร้านพันธมิตร", cost: 120 }
];

/* ---------- ผู้ใช้ / รหัสผ่าน ---------- */
let me = null, data = null;
async function hashPw(pw, salt) {
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pw}`));
    return "s256:" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "plain:" + pw; // เบราว์เซอร์ที่ไม่รองรับ Web Crypto (production ต้อง hash ฝั่ง server)
}
const makeSalt = () => { const a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256)); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); };
async function makeUser({ id, email, name, plate, password }) {
  const salt = makeSalt();
  return { id, email, name, plate: plate || "", salt, hash: await hashPw(password, salt), status: "active", isVerified: true, createdAt: new Date().toISOString() };
}
async function getUsers() {
  let users = db.get(KEYS.users, []);
  if (Array.isArray(users) && users.some((u) => /@bymail\.net$/i.test(u.email))) { // ย้ายบัญชีที่สร้างไว้ด้วยโดเมนเดิม
    users = users.map((u) => ({ ...u, email: u.email.replace(/@bymail\.net$/i, "@bumail.net") })); db.set(KEYS.users, users);
  }
  if (!Array.isArray(users) || !users.length) {
    users = [await makeUser({ id: "6612345678", email: "student@bumail.net", name: "ธนกร ใจดี", plate: "1กข 1248 กรุงเทพฯ", password: "password123" })];
    db.set(KEYS.users, users);
  }
  return users;
}
const saveUsers = (users) => db.set(KEYS.users, users);

function setSession(user, remember) {
  db.del(KEYS.session); try { sessionStorage.removeItem(KEYS.session); } catch { /* ignore */ }
  const payload = JSON.stringify({ id: user.id, createdAt: new Date().toISOString() });
  try { (remember ? localStorage : sessionStorage).setItem(KEYS.session, payload); } catch { /* ignore */ }
}
function clearSession() { db.del(KEYS.session); try { sessionStorage.removeItem(KEYS.session); } catch { /* ignore */ } }
function readSession() {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try { const s = JSON.parse(store().getItem(KEYS.session) || "null"); if (s?.id) return s; } catch { /* ignore */ }
  }
  return null;
}

/* ---------- ข้อมูลต่อผู้ใช้ ---------- */
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function defaultData(user) {
  const d = { score: 90, points: 0, ledger: [], coupons: [], reservation: null, session: null, history: [], checkins: { day: dayKey(), zones: [] }, reports: { day: dayKey(), count: 0 }, waitlist: [], notifications: [] };
  if (user.id === "6612345678") { // ข้อมูลตัวอย่างสำหรับบัญชีเดโม
    d.points = 40;
    d.history = [
      { t: Date.parse("2026-10-20T09:00:00+07:00"), zoneName: "ตึกเพชร", space: "P-113", durationMs: 138 * 60000, status: "done", fromRes: true },
      { t: Date.parse("2026-10-18T09:00:00+07:00"), zoneName: "ตึก A", space: "A-021", durationMs: 182 * 60000, status: "done", fromRes: false },
      { t: Date.parse("2026-10-14T09:00:00+07:00"), zoneName: "โรงอาหารกลาง", space: "F-045", durationMs: 0, status: "canceled", fromRes: true }
    ];
    d.ledger = [{ t: Date.parse("2026-10-20T09:05:00+07:00"), kind: "points", delta: 40, reason: "คะแนนต้อนรับบัญชีเดโม" }];
  }
  return d;
}
function loadData(user) {
  const d = { ...defaultData(user), ...(db.get(KEYS.data(user.id), {})) };
  if (d.checkins?.day !== dayKey()) d.checkins = { day: dayKey(), zones: [] };
  if (d.reports?.day !== dayKey()) d.reports = { day: dayKey(), count: 0 };
  return d;
}
function saveData() { if (me) db.set(KEYS.data(me.id), data); }
function addLedger(kind, delta, reason) {
  if (kind === "points") data.points = Math.max(0, data.points + delta);
  else data.score = Math.max(0, Math.min(100, data.score + delta));
  data.ledger.unshift({ t: Date.now(), kind, delta, reason });
  data.ledger = data.ledger.slice(0, 40);
}
function notify(title, body) { data.notifications.unshift({ t: Date.now(), title, body }); data.notifications = data.notifications.slice(0, 10); }

/* ---------- UI helpers ---------- */
const fmtTime = (t) => new Date(t).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (t) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const fmtDur = (ms) => { if (!ms) return "—"; const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${String(m % 60).padStart(2, "0")} นาที` : `${m} นาที`; };
let toastTimer;
function toast(message) { $("#toastText").textContent = message; $("#toast").classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3200); }
const scoreLabel = (s) => (s >= 90 ? "ดีมาก" : s >= 70 ? "ดี" : s >= 50 ? "พอใช้" : "ควรปรับปรุง");

const PAGE_LABELS = {
  dashboard: ["LIVE STATUS", "ภาพรวมที่จอดรถ"], map: ["RANGSIT CAMPUS", "แผนผังลานจอดมอเตอร์ไซค์"], reservation: ["YOUR BOOKING", "การจองของฉัน"],
  rewards: ["POINT SYSTEM", "เช็คอิน & คะแนน"], history: ["ACTIVITY LOG", "ประวัติการจอด"], guide: ["HOW TO USE", "แนะนำการใช้งาน"],
  profile: ["ACCOUNT SETTINGS", "โปรไฟล์"], report: ["COMMUNITY CARE", "รายงานสถานะ"]
};
function goPage(id) {
  if (!PAGE_LABELS[id]) return;
  $$(".page").forEach((p) => p.classList.remove("active-page"));
  $$(".nav-item").forEach((n) => n.classList.remove("active"));
  $("#" + id).classList.add("active-page");
  $(`.nav-item[data-page="${id}"]`)?.classList.add("active");
  const [kicker, title] = PAGE_LABELS[id];
  $("#pageKicker").textContent = id === "dashboard" && me ? `สวัสดี ${me.name.split(" ")[0]}` : kicker;
  $("#pageTitle").textContent = title;
  $(".sidebar").classList.remove("open"); $("#notificationPop").classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Render ---------- */
let mapFilter = "all", mapTerm = "";
const barClass = (c) => (c === "green" ? "" : c === "yellow" ? "warn" : "full");
function renderZones() {
  const list = zones();
  $("#zoneList").innerHTML = list.map((z) => `<div class="zone-row"><div class="zone-icon">P</div><div><strong>${esc(z.name)}</strong><small>${esc(z.detail)}</small></div><div class="zone-status"><b>${z.spaces} <small>/ ${z.total} ว่าง</small></b><div class="progress ${barClass(z.color)}"><i style="width:${Math.max(3, (z.spaces / z.total) * 100)}%"></i></div></div></div>`).join("");
  $("#mapZoneList").innerHTML = list.map((z) => `<div class="map-zone-row" data-zone="${z.id}"><div><strong>${esc(z.name)}</strong><small>${esc(z.detail)}</small></div><div><b style="color:var(--${z.color === "green" ? "green" : z.color === "yellow" ? "amber" : "red"})">${z.spaces}</b> <small>ว่าง</small></div>${z.spaces ? `<button class="reserve-zone" data-zone="${z.id}">จองที่จอด</button>` : `<button class="wait-zone" data-zone="${z.id}">เข้าคิวรอ</button>`}</div>`).join("");
  $("#mapPins").innerHTML = list.map((z) => `<button class="map-pin ${z.color}" data-zone="${z.id}" aria-label="${esc(z.name)} ว่าง ${z.spaces} ช่อง" style="left:${z.pos.split(";")[0]};top:${z.pos.split(";")[1]}"><span>${z.spaces}</span></button>`).join("");
  const free = list.reduce((a, z) => a + z.spaces, 0), total = list.reduce((a, z) => a + z.total, 0);
  $("#availableLarge").textContent = free; $("#availableCount").textContent = free; $("#totalCount").textContent = total;
  $("#usageRate").textContent = `${Math.round(((total - free) / total) * 100)}%`;
  $("#zoneCountText").textContent = `${list.length} โซนจอดรถ`;
  $("#gaugeValue").style.strokeDasharray = `${Math.round((free / total) * 226)} 230`;
  const t = fmtTime(zoneState.updatedAt); $("#updatedAt").textContent = t; $("#updatedAtSmall").textContent = `อัปเดต ${t} น.`;
  applyMapFilter();
  renderZoneSelects();
}
function applyMapFilter() {
  $$(".map-zone-row,.map-pin").forEach((el) => {
    const z = zoneById(el.dataset.zone); if (!z) return;
    const okFilter = mapFilter === "all" || z.color === mapFilter;
    const okTerm = !mapTerm || `${z.name} ${z.detail}`.toLowerCase().includes(mapTerm);
    el.style.display = okFilter && okTerm ? "" : "none";
  });
}
let zoneSelectsBuilt = false;
function renderZoneSelects() {
  if (zoneSelectsBuilt) return;
  const opts = ZONE_DEFS.map((z) => `<option value="${z.id}">${esc(z.name)}</option>`).join("");
  $("#waitZone").innerHTML = opts; $("#reportZone").innerHTML = opts; zoneSelectsBuilt = true;
}

function renderReservation() {
  const r = data.reservation;
  const has = !!r;
  $("#resTicket").classList.toggle("hidden", !has); $("#resEmpty").classList.toggle("hidden", has);
  $("#cancelReservation").classList.toggle("hidden", !has); $("#countdown").classList.toggle("hidden", !has);
  $("#bookingBody").classList.toggle("hidden", !has); $("#bookingEmpty").classList.toggle("hidden", has);
  $("#resBadge").classList.toggle("hidden", !has);
  if (!has) return;
  $("#resZone").textContent = r.zoneShort; $("#resSpace").textContent = r.space; $("#resStart").textContent = `${fmtTime(r.createdAt)} น.`;
  $("#resWindow").textContent = `${r.windowMin} นาที`;
  $("#bigSlotSpace").textContent = r.space; $("#bigSlotZone").textContent = r.zoneName;
  $("#resCreated").textContent = `วันนี้, ${fmtTime(r.createdAt)} น.`; $("#resExpire").textContent = `${fmtTime(r.expiresAt)} น.`;
  $("#resPlate").textContent = me.plate || "ไม่ได้ระบุ";
  tickCountdown();
}
function tickCountdown() {
  const r = data?.reservation; if (!r) return;
  const left = Math.max(0, r.expiresAt - Date.now());
  const m = String(Math.floor(left / 60000)).padStart(2, "0"), s = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  $("#countdown").textContent = `${m}:${s}`; $("#bookingTime").textContent = `เหลือ ${Math.ceil(left / 60000)} นาที`;
}

function renderPoints() {
  $("#scoreNumber").textContent = data.score; $("#scoreProfile").textContent = data.score; $("#ptsScore").textContent = data.score;
  $("#scoreText").textContent = scoreLabel(data.score); $("#scoreLabel").textContent = scoreLabel(data.score);
  $("#scoreRing").style.background = `conic-gradient(#cfd6e0 0 ${data.score}%, #2a2f36 ${data.score}%)`;
  $("#scoreMarker").style.marginLeft = `${data.score}%`;
  $("#ptsBalance").textContent = data.points; $("#pPoints").textContent = data.points; $("#chipPoints").textContent = `${data.points} คะแนน`;
  const used = data.checkins.zones.length; $("#ptsCheckins").textContent = `${used} / ${MAX_CHECKINS}`;

  const s = data.session;
  $("#sessionBox").innerHTML = s ? `กำลังจอดที่ <b>${esc(s.zoneName)}</b> ช่อง <b>${esc(s.space)}</b> ตั้งแต่ ${fmtTime(s.start)} น. <button class="outline-btn" id="checkoutBtn" style="margin-top:10px">เช็คเอาท์ (ออกจากลาน)</button>` : "ยังไม่ได้เช็คอิน เลือกโซนด้านล่างเมื่อจอดรถแล้ว";
  $("#checkinGrid").innerHTML = zones().map((z) => {
    const done = data.checkins.zones.includes(z.id);
    const reason = s ? "จอดอยู่แล้ว" : done ? "เช็คอินแล้ววันนี้" : used >= MAX_CHECKINS ? "ครบโควตาวันนี้" : "";
    return `<div class="checkin-item"><div><strong>${esc(z.short)}</strong><small>${z.spaces ? `ว่าง ${z.spaces} ช่อง` : "เต็ม"}</small></div><button class="primary-btn" data-checkin="${z.id}" ${reason ? "disabled" : ""}>${reason || "เช็คอิน +3"}</button></div>`;
  }).join("");

  $("#rewardList").innerHTML = REWARDS.map((r) => `<div class="reward-item"><div><strong>${esc(r.name)}</strong><small>${esc(r.desc)} · ${r.cost} คะแนน</small></div><button class="primary-btn" data-redeem="${r.id}" ${data.points < r.cost ? "disabled" : ""}>แลก</button></div>`).join("");
  const mine = data.coupons.filter((c) => !c.used);
  $("#myCoupons").innerHTML = mine.length ? `<b>สิทธิ์ของฉัน</b><br>${mine.map((c) => `${esc(c.name)}${c.code ? ` · รหัส <b>${esc(c.code)}</b>` : " · ใช้ได้ตอนจอง"}`).join("<br>")}` : "ยังไม่มีสิทธิ์ที่แลกไว้";
  $("#ledgerList").innerHTML = data.ledger.length ? data.ledger.slice(0, 10).map((l) => `<p><span>${fmtDate(l.t)} ${fmtTime(l.t)} · ${esc(l.reason)} <small style="color:#7d8794">(${l.kind === "points" ? "คะแนนสะสม" : "Parking Score"})</small></span><b class="${l.delta >= 0 ? "pos" : "neg"}">${l.delta >= 0 ? "+" : ""}${l.delta}</b></p>`).join("") : `<p><span>ยังไม่มีรายการ</span></p>`;
}

function renderHistory() {
  const h = data.history, now = new Date();
  const done = h.filter((x) => x.status === "done");
  $("#hCount").textContent = h.filter((x) => { const d = new Date(x.t); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && x.status === "done"; }).length;
  const durs = done.filter((x) => x.durationMs); $("#hAvg").textContent = durs.length ? (durs.reduce((a, x) => a + x.durationMs, 0) / durs.length / 3600000).toFixed(1) : "—";
  const resOutcomes = h.filter((x) => x.fromRes || x.status === "noshow"), onTime = resOutcomes.filter((x) => x.status === "done").length;
  $("#hOnTime").textContent = resOutcomes.length ? Math.round((onTime / resOutcomes.length) * 100) : "—";
  const label = { done: ["success", "เสร็จสิ้น"], canceled: ["canceled", "ยกเลิก"], noshow: ["canceled", "ไม่มาตามนัด"] };
  $("#historyBody").innerHTML = h.length ? h.slice().sort((a, b) => b.t - a.t).map((x) => `<tr><td>${fmtDate(x.t)}</td><td><b>${esc(x.zoneName)}</b><small>${esc(x.space)}</small></td><td>${fmtDur(x.durationMs)}</td><td><span class="status ${label[x.status][0]}">${label[x.status][1]}</span></td></tr>`).join("") : `<tr><td colspan="4">ยังไม่มีประวัติการจอด</td></tr>`;
}
function renderNotifications() {
  const n = data.notifications;
  $("#notifDot").classList.toggle("hidden", !n.length);
  $("#notifList").innerHTML = n.length ? n.map((x) => `<article><div class="notice-icon blue">!</div><div><strong>${esc(x.title)}</strong><p>${esc(x.body)} · ${fmtTime(x.t)} น.</p></div></article>`).join("") : `<p style="font-size:11px;color:var(--muted);margin:14px 0 4px">ไม่มีการแจ้งเตือนใหม่</p>`;
}
function renderWaitlist() {
  $("#waitList").innerHTML = data.waitlist.length ? `<b>คิวของฉัน</b><br>${data.waitlist.map((w) => `${esc(zoneById(w.zoneId).short)} · ลำดับที่ ${w.pos} <button class="link-button" data-leave="${w.zoneId}">ออกจากคิว</button>`).join("<br>")}` : "";
}
function renderProfile() {
  const initial = me.name.trim().charAt(0) || "M";
  $$(".avatar,.profile-large-avatar").forEach((el) => (el.textContent = initial));
  $(".profile-chip strong").textContent = me.name; $("#profileName").textContent = me.name;
  $("#pId").textContent = me.id; $("#pEmail").textContent = me.email; $("#pPlate").textContent = me.plate || "ไม่ได้ระบุ";
}
function renderAll() { renderZones(); renderReservation(); renderPoints(); renderHistory(); renderNotifications(); renderWaitlist(); renderProfile(); }

/* ---------- การจอง / เช็คอิน ---------- */
function openReserve(id) {
  const z = zoneById(id); if (!z) return;
  if (data.reservation) return toast("คุณมีการจองอยู่แล้ว ยกเลิกก่อนหากต้องการจองใหม่");
  if (data.session) return toast("คุณกำลังจอดอยู่ กรุณาเช็คเอาท์ก่อนจองใหม่");
  if (!z.spaces) return toast("โซนนี้เต็มแล้ว ลองเข้าคิวรอ");
  const hasHold = data.coupons.some((c) => c.id === "hold30" && !c.used);
  $("#modalTitle").textContent = `จอง ${z.short}`; $("#modalSubtitle").textContent = `เหลือ ${z.spaces} ช่อง · ระบบจะกันที่จอดไว้ให้คุณ`;
  $("#timeOptions").innerHTML = [15, 20, ...(hasHold ? [30] : [])].map((m, i) => `<button type="button" class="time-choice ${i === 0 ? "active" : ""}" data-min="${m}">ถึงภายใน ${m} นาที${m === 30 ? " (คูปอง)" : ""}</button>`).join("");
  $("#modalScore").textContent = data.score;
  $("#reserveModal").dataset.zone = id; $("#reserveModal").classList.remove("hidden");
}
const spaceCode = (z) => `${z.id}-${String(Math.floor(Math.random() * z.total) + 1).padStart(3, "0")}`;
function confirmReservation() {
  const z = zoneById($("#reserveModal").dataset.zone); if (!z) return;
  if (data.reservation || data.session) return;
  if (!z.spaces) { $("#reserveModal").classList.add("hidden"); return toast("ขออภัย โซนนี้เพิ่งเต็ม"); }
  const windowMin = Number($("#timeOptions .time-choice.active")?.dataset.min) || 15;
  if (windowMin === 30) { const c = data.coupons.find((x) => x.id === "hold30" && !x.used); if (c) c.used = true; }
  adjustSpaces(z.id, -1);
  const now = Date.now();
  data.reservation = { zoneId: z.id, zoneName: z.name, zoneShort: z.short, space: spaceCode(z), createdAt: now, windowMin, expiresAt: now + windowMin * 60000 };
  data.waitlist = data.waitlist.filter((w) => w.zoneId !== z.id);
  notify("จองที่จอดสำเร็จ", `${z.short} · ${data.reservation.space} ถือสิทธิ์ ${windowMin} นาที`);
  saveData(); $("#reserveModal").classList.add("hidden"); renderAll();
  toast(`จอง ${z.short} สำเร็จ · ${data.reservation.space}`); goPage("reservation");
}
function cancelReservation() {
  const r = data.reservation; if (!r) return toast("ยังไม่มีการจองที่ใช้งานอยู่");
  const late = r.expiresAt - Date.now() < HOLD_LATE_MS;
  adjustSpaces(r.zoneId, +1);
  data.history.push({ t: Date.now(), zoneName: r.zoneShort, space: r.space, durationMs: 0, status: "canceled", fromRes: true });
  data.reservation = null;
  if (late) addLedger("score", -10, "ยกเลิกการจองกระชั้นชิด");
  notify("ยกเลิกการจองแล้ว", late ? "หัก Parking Score 10 คะแนน (ยกเลิกกระชั้นชิด)" : "ไม่มีการหักคะแนน");
  saveData(); renderAll();
  toast(late ? "ยกเลิกการจองแล้ว · หัก 10 คะแนนจากการยกเลิกกระชั้นชิด" : "ยกเลิกการจองแล้ว · ไม่มีการหักคะแนน");
}
function expireReservation() {
  const r = data.reservation; if (!r) return;
  adjustSpaces(r.zoneId, +1);
  data.history.push({ t: r.createdAt, zoneName: r.zoneShort, space: r.space, durationMs: 0, status: "noshow", fromRes: true });
  data.reservation = null; addLedger("score", -10, "ไม่มาตามเวลาที่จอง");
  notify("การจองหมดเวลา", `${r.zoneShort} · ${r.space} · หัก Parking Score 10 คะแนน`);
  saveData(); renderAll(); toast("การจองหมดเวลา · หัก 10 คะแนน");
}
function checkIn(zoneId) {
  const z = zoneById(zoneId); if (!z) return;
  if (data.session) return toast("คุณเช็คอินอยู่แล้ว กรุณาเช็คเอาท์ก่อน");
  if (data.checkins.zones.includes(zoneId)) return toast("วันนี้คุณเช็คอินโซนนี้ไปแล้ว");
  if (data.checkins.zones.length >= MAX_CHECKINS) return toast(`เช็คอินได้สูงสุด ${MAX_CHECKINS} ครั้งต่อวัน`);
  const r = data.reservation;
  if (r && r.zoneId !== zoneId) return toast(`คุณมีการจองที่ ${r.zoneShort} กรุณาเช็คอินโซนนั้นหรือยกเลิกการจองก่อน`);
  let space, fromRes = false;
  if (r) { space = r.space; fromRes = true; data.reservation = null; addLedger("score", +2, "มาถึงตามเวลาที่จอง"); }
  else { if (!z.spaces) return toast("โซนนี้เต็มแล้ว"); adjustSpaces(zoneId, -1); space = spaceCode(z); }
  data.session = { zoneId, zoneName: z.short, space, start: Date.now(), fromRes };
  data.checkins.zones.push(zoneId);
  addLedger("points", +3, `เช็คอินที่จอด ${z.short}`);
  notify("เช็คอินสำเร็จ", `${z.short} · ${space} · +3 คะแนน`);
  saveData(); renderAll(); toast(`เช็คอิน ${z.short} สำเร็จ · +3 คะแนน`);
}
function checkOut() {
  const s = data.session; if (!s) return;
  adjustSpaces(s.zoneId, +1);
  data.history.push({ t: s.start, zoneName: s.zoneName, space: s.space, durationMs: Date.now() - s.start, status: "done", fromRes: s.fromRes });
  data.session = null; saveData(); renderAll(); toast("เช็คเอาท์สำเร็จ · ขอบคุณที่ใช้บริการ");
}
function redeem(id) {
  const r = REWARDS.find((x) => x.id === id); if (!r) return;
  if (data.points < r.cost) return toast("คะแนนสะสมไม่เพียงพอ");
  if (id === "score10" && data.score >= 100) return toast("Parking Score เต็ม 100 แล้ว");
  addLedger("points", -r.cost, `แลก ${r.name}`);
  if (id === "score10") addLedger("score", +10, "แลกคะแนนเพิ่ม Parking Score");
  else {
    const code = ["coffee", "wash"].includes(id) ? "MB-" + Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("") : "";
    data.coupons.unshift({ id, name: r.name, code, t: Date.now(), used: false });
  }
  notify("แลกคะแนนสำเร็จ", r.name); saveData(); renderAll(); toast(`แลก "${r.name}" สำเร็จ`);
}

/* ---------- เหตุการณ์: ฟอร์ม ---------- */
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#authError"), email = $("#email").value.trim().toLowerCase(), id = $("#studentId").value.trim(), password = $("#password").value;
  if (!EMAIL_RE.test(email)) return (err.textContent = `กรุณาใช้อีเมลที่ลงท้ายด้วย ${ALLOWED_DOMAIN} เท่านั้น`);
  if (!/^\d{10}$/.test(id)) return (err.textContent = "กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก");
  const user = (await getUsers()).find((u) => u.email.toLowerCase() === email && u.id === id);
  if (!user || (await hashPw(password, user.salt)) !== user.hash) return (err.textContent = "อีเมล รหัสนักศึกษา หรือรหัสผ่านไม่ถูกต้อง");
  if (user.status !== "active" || !user.isVerified) return (err.textContent = "บัญชีนี้ยังไม่พร้อมใช้งาน");
  err.textContent = ""; startSession(user, $("#remember").checked); toast(`ยินดีต้อนรับกลับมา ${user.name}`);
});
$("#forgotLink").addEventListener("click", (e) => { e.preventDefault(); $("#authError").textContent = "ฟีเจอร์รีเซ็ตรหัสผ่านต้องใช้ระบบ backend — โปรดติดต่อผู้ดูแลระบบ"; });
$("#showRegister").addEventListener("click", () => { $("#loginForm").classList.add("hidden"); $("#registerForm").classList.remove("hidden"); });
$("#showLogin").addEventListener("click", () => { $("#registerForm").classList.add("hidden"); $("#loginForm").classList.remove("hidden"); });
$("#registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#regName").value.trim(), email = $("#regEmail").value.trim().toLowerCase(), id = $("#regId").value.trim(), plate = $("#regPlate").value.trim();
  const password = $("#regPassword").value, confirm = $("#regPasswordConfirm").value, msg = $("#regMessage");
  msg.classList.remove("form-success"); msg.classList.add("form-error");
  if (name.length < 2) return (msg.textContent = "กรุณากรอกชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร");
  if (!EMAIL_RE.test(email)) return (msg.textContent = `กรุณาใช้อีเมลที่ลงท้ายด้วย ${ALLOWED_DOMAIN} เท่านั้น`);
  if (!/^\d{10}$/.test(id)) return (msg.textContent = "กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก");
  if (password.length < 8) return (msg.textContent = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  if (password !== confirm) return (msg.textContent = "รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
  const users = await getUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) return (msg.textContent = "อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ");
  if (users.some((u) => u.id === id)) return (msg.textContent = "รหัสนักศึกษานี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ");
  const user = await makeUser({ id, email, name, plate, password });
  saveUsers([...users, user]);
  msg.classList.remove("form-error"); msg.classList.add("form-success"); msg.textContent = "สร้างบัญชีสำเร็จ กำลังพาคุณเข้าสู่ระบบ...";
  setTimeout(() => { startSession(user, true); toast("บัญชีของคุณพร้อมใช้งานแล้ว"); e.target.reset(); msg.textContent = ""; }, 450);
});

function startSession(user, remember) {
  me = user; data = loadData(user); setSession(user, remember);
  $("#authView").classList.add("hidden"); $("#appView").classList.remove("hidden");
  renderAll(); goPage("dashboard");
}
async function restoreSession() {
  const s = readSession(); if (!s) return;
  const user = (await getUsers()).find((u) => u.id === s.id && u.status === "active" && u.isVerified);
  if (user) startSession(user, !!db.get(KEYS.session, null)); else clearSession();
}

/* ---------- เหตุการณ์: UI ---------- */
$$(".nav-item[data-page], [data-page-go]").forEach((b) => b.addEventListener("click", () => goPage(b.dataset.page || b.dataset.pageGo)));
$("#menuToggle").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
$("#logout").addEventListener("click", () => { clearSession(); me = null; data = null; $("#appView").classList.add("hidden"); $("#authView").classList.remove("hidden"); $("#password").value = ""; $(".sidebar").classList.remove("open"); });
$("#notificationButton").addEventListener("click", () => $("#notificationPop").classList.toggle("hidden"));
$("#clearNotifications").addEventListener("click", () => { data.notifications = []; saveData(); renderNotifications(); $("#notificationPop").classList.add("hidden"); toast("ล้างการแจ้งเตือนแล้ว"); });
$("#closeModal").addEventListener("click", () => $("#reserveModal").classList.add("hidden"));
$("#reserveModal").addEventListener("click", (e) => { if (e.target.id === "reserveModal") e.currentTarget.classList.add("hidden"); });
$("#timeOptions").addEventListener("click", (e) => { const b = e.target.closest(".time-choice"); if (!b) return; $$("#timeOptions .time-choice").forEach((x) => x.classList.remove("active")); b.classList.add("active"); });
$("#confirmReservation").addEventListener("click", confirmReservation);
$("#cancelReservation").addEventListener("click", cancelReservation);

function navigate() {
  window.open("https://www.google.com/maps/dir/?api=1&destination=Bangkok+University+Rangsit+Campus", "_blank", "noopener"); toast("กำลังเปิด Google Maps");
}
$("#navigateBtn").addEventListener("click", navigate); $("#navigateBtn2").addEventListener("click", navigate);

document.addEventListener("click", (e) => {
  const t = e.target;
  const reserve = t.closest(".reserve-zone,.map-pin"); if (reserve && data) return openReserve(reserve.dataset.zone);
  const wait = t.closest(".wait-zone"); if (wait && data) { $("#waitZone").value = wait.dataset.zone; goPage("reservation"); return; }
  const ci = t.closest("[data-checkin]"); if (ci && data) return checkIn(ci.dataset.checkin);
  const rd = t.closest("[data-redeem]"); if (rd && data) return redeem(rd.dataset.redeem);
  const lv = t.closest("[data-leave]"); if (lv && data) { data.waitlist = data.waitlist.filter((w) => w.zoneId !== lv.dataset.leave); saveData(); renderWaitlist(); return toast("ออกจากคิวแล้ว"); }
  if (t.closest("#checkoutBtn")) return checkOut();
  if (!t.closest("#notificationPop,#notificationButton")) $("#notificationPop").classList.add("hidden");
});

$("#joinWaitlist").addEventListener("click", () => {
  const id = $("#waitZone").value, z = zoneById(id), res = $("#waitResult");
  if (z.spaces > 0) { res.textContent = ""; return toast(`${z.short} ยังมีที่ว่าง ${z.spaces} ช่อง จองได้เลย`); }
  if (data.waitlist.some((w) => w.zoneId === id)) return toast("คุณอยู่ในคิวโซนนี้แล้ว");
  const pos = Math.floor(Math.random() * 4) + 2; // ลำดับจำลอง — ระบบจริงต้องนับจากคิวรวมบนเซิร์ฟเวอร์
  data.waitlist.push({ zoneId: id, pos, t: Date.now() }); saveData(); renderWaitlist();
  res.textContent = `คุณอยู่ลำดับที่ ${pos} ของ ${z.short}`; toast("เพิ่มคุณเข้า Waiting List แล้ว");
});
$("#reportForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const res = $("#reportResult");
  if (data.reports.count >= MAX_REPORTS) { res.textContent = ""; return toast(`ส่งรายงานได้สูงสุด ${MAX_REPORTS} ครั้งต่อวัน`); }
  const reports = db.get(KEYS.reports, []);
  reports.push({ userId: me.id, type: $("#issueType").value, zone: $("#reportZone").value, text: $("#reportText").value.trim().slice(0, 500), t: Date.now() });
  db.set(KEYS.reports, reports.slice(-200));
  data.reports.count++; addLedger("points", +5, `รายงานสถานะ: ${$("#issueType").value}`);
  notify("ส่งรายงานสำเร็จ", "ได้รับ +5 คะแนนสะสม"); saveData(); renderAll();
  res.textContent = "ส่งรายงานสำเร็จ! คุณได้รับ +5 คะแนน"; e.target.reset(); toast("ขอบคุณที่ช่วยดูแลพื้นที่จอดรถ · +5 คะแนน");
});
$("#mapSearch").addEventListener("input", (e) => { mapTerm = e.target.value.trim().toLowerCase(); applyMapFilter(); });
$$(".filter").forEach((b) => b.addEventListener("click", () => { $$(".filter").forEach((x) => x.classList.remove("active")); b.classList.add("active"); mapFilter = b.dataset.filter; applyMapFilter(); }));
$("#editProfile").addEventListener("click", async () => {
  const name = prompt("ชื่อ-นามสกุล", me.name); if (name === null) return;
  const plate = prompt("ทะเบียนมอเตอร์ไซค์", me.plate || ""); if (plate === null) return;
  if (name.trim().length < 2) return toast("ชื่อต้องมีอย่างน้อย 2 ตัวอักษร");
  me.name = name.trim().slice(0, 60); me.plate = plate.trim().slice(0, 20);
  saveUsers((await getUsers()).map((u) => (u.id === me.id ? { ...u, name: me.name, plate: me.plate } : u)));
  renderAll(); toast("บันทึกข้อมูลแล้ว");
});

/* ---------- เรียลไทม์ (จำลอง) ---------- */
function tickZones() {
  // จำลองการเข้า-ออกของรถ; ระบบจริงให้แทนที่ด้วยข้อมูลจากเซ็นเซอร์/เซิร์ฟเวอร์ (WebSocket/SSE)
  zoneState = loadZones();
  ZONE_DEFS.forEach((d) => { const delta = Math.floor(Math.random() * 7) - 3; zoneState.spaces[d.id] = Math.max(0, Math.min(d.total, zoneState.spaces[d.id] + delta)); });
  saveZones();
  if (!data) return;
  const freed = data.waitlist.filter((w) => zoneState.spaces[w.zoneId] > 0);
  freed.forEach((w) => { const z = zoneById(w.zoneId); notify("มีที่ว่างแล้ว!", `${z.short} ว่าง ${z.spaces} ช่อง จองได้ทันที`); toast(`${z.short} มีที่ว่างแล้ว!`); });
  if (freed.length) { data.waitlist = data.waitlist.filter((w) => zoneState.spaces[w.zoneId] <= 0); saveData(); renderNotifications(); renderWaitlist(); }
  renderZones(); renderPoints();
}
setInterval(tickZones, 10000);
setInterval(() => {
  if (!data) return;
  if (data.reservation && data.reservation.expiresAt <= Date.now()) expireReservation(); else tickCountdown();
  if (data.checkins.day !== dayKey()) { data.checkins = { day: dayKey(), zones: [] }; data.reports = { day: dayKey(), count: 0 }; saveData(); renderPoints(); }
}, 1000);
window.addEventListener("storage", (e) => { // ซิงก์ข้ามแท็บ
  if (e.key === KEYS.zones) { zoneState = loadZones(); if (data) renderZones(); }
  else if (me && e.key === KEYS.data(me.id)) { data = loadData(me); renderAll(); }
});

restoreSession();
