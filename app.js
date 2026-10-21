const zones = [
  { id: "A", name: "โซนตึก A", detail: "ใกล้คณะบริหารธุรกิจ", spaces: 74, total: 180, color: "green", pos: "18%;46%" },
  { id: "P", name: "โซนตึกเพชร", detail: "อาคารเพชร", spaces: 38, total: 140, color: "green", pos: "66%;43%" },
  { id: "C", name: "โซนคณะนิเทศศาสตร์", detail: "Communication Arts", spaces: 12, total: 120, color: "yellow", pos: "25%;68%" },
  { id: "F", name: "โซนโรงอาหารกลาง", detail: "Central Canteen", spaces: 0, total: 200, color: "red", pos: "50%;67%" }
];
let score = 90;
let reservation = { zone: "ตึกเพชร", space: "P-042", active: true };
let secondsLeft = 768;
const USERS_KEY = "buParkUsers";
const SESSION_KEY = "buParkSession";
const demoUser = {
  id: "6612345678", email: "student@bumail.net", password: "password123",
  name: "ก้องภพ", status: "active", isVerified: true, createdAt: "2026-10-21T00:00:00.000Z"
};
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function getUsers() {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(saved) && saved.length ? saved : [demoUser];
  } catch { return [demoUser]; }
}
function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function setSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, createdAt: new Date().toISOString() })); }
function updateUserUI(user) {
  const initials = user.name.trim().charAt(0) || "B";
  $$(".avatar,.profile-large-avatar").forEach(el => el.textContent = initials);
  $$(".profile-chip strong").forEach(el => el.textContent = user.name);
  $(".user-profile h3").textContent = user.name;
  const meta = $$(".profile-meta b");
  if (meta[0]) meta[0].textContent = user.id;
}

function renderZones() {
  const cardList = $("#zoneList"); const mapList = $("#mapZoneList");
  cardList.innerHTML = zones.map(z => `<div class="zone-row"><div class="zone-icon">P</div><div><strong>${z.name}</strong><small>${z.detail}</small></div><div class="zone-status"><b>${z.spaces} <small>/ ${z.total} ว่าง</small></b><div class="progress ${z.color === 'green' ? '' : z.color === 'yellow' ? 'warn' : 'full'}"><i style="width:${Math.max(3,(z.spaces / z.total) * 100)}%"></i></div></div></div>`).join("");
  mapList.innerHTML = zones.map(z => `<div class="map-zone-row" data-zone="${z.id}"><div><strong>${z.name}</strong><small>${z.detail}</small></div><div><b style="color:var(--${z.color === 'green' ? 'green' : z.color === 'yellow' ? 'amber' : 'red'})">${z.spaces}</b> <small>ว่าง</small></div>${z.spaces ? `<button class="reserve-zone" data-zone="${z.id}">จองที่จอด</button>` : `<button class="wait-zone" data-zone="${z.id}">เข้าคิวรอ</button>`}</div>`).join("");
  $("#mapPins").innerHTML = zones.map(z => `<button class="map-pin ${z.color}" data-zone="${z.id}" style="left:${z.pos.split(';')[0]};top:${z.pos.split(';')[1]}"><span>${z.spaces}</span></button>`).join("");
  $$(".reserve-zone,.map-pin").forEach(b => b.addEventListener("click", () => openReserve(b.dataset.zone)));
  $$(".wait-zone").forEach(b => b.addEventListener("click", () => { $("#waitZone").value = "โซนโรงอาหารกลาง"; goPage("reservation"); }));
}
function goPage(id) {
  $$(".page").forEach(p => p.classList.remove("active-page"));
  $$(".nav-item").forEach(n => n.classList.remove("active"));
  $("#" + id).classList.add("active-page");
  $(`.nav-item[data-page="${id}"]`)?.classList.add("active");
  const labels = { dashboard: ["GOOD MORNING, THANAKORN", "ภาพรวมที่จอดรถ"], map: ["RANGSIT CAMPUS", "แผนที่มหาวิทยาลัย"], reservation: ["YOUR BOOKING", "การจองของฉัน"], history: ["ACTIVITY LOG", "ประวัติการจอด"], profile: ["ACCOUNT SETTINGS", "โปรไฟล์"], report: ["COMMUNITY CARE", "แจ้งปัญหา"] };
  $("#pageKicker").textContent = labels[id][0]; $("#pageTitle").textContent = labels[id][1];
  $(".sidebar").classList.remove("open"); window.scrollTo({ top: 0, behavior: "smooth" });
}
function toast(message) { $("#toastText").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3200); }
function openReserve(id) { const z = zones.find(x => x.id === id); if (!z || !z.spaces) return; $("#modalTitle").textContent = `จอง ${z.name}`; $("#modalSubtitle").textContent = `เหลือ ${z.spaces} ช่อง · ระบบจะกันที่จอดไว้ให้คุณ`; $("#reserveModal").dataset.zone = id; $("#reserveModal").classList.remove("hidden"); }
function updateScore(change) { score = Math.max(0, Math.min(100, score + change)); $("#scoreNumber").textContent = score; $("#scoreProfile").textContent = score; }
function startSession(user) { setSession(user); updateUserUI(user); $("#authView").classList.add("hidden"); $("#appView").classList.remove("hidden"); renderZones(); }
function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!session?.id) return;
    const user = getUsers().find(u => u.id === session.id && u.status === "active" && u.isVerified);
    if (user) startSession(user);
    else localStorage.removeItem(SESSION_KEY);
  } catch { localStorage.removeItem(SESSION_KEY); }
}

$("#loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const email = $("#email").value.trim().toLowerCase(); const id = $("#studentId").value.trim(); const password = $("#password").value;
  if (!/^\d{10}$/.test(id)) return $("#authError").textContent = "กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก";
  if (!/^[^\s@]+@bumail\.th$/i.test(email)) return $("#authError").textContent = "กรุณาใช้อีเมลมหาวิทยาลัย @bumail.th";
  const user = getUsers().find(u => u.email.toLowerCase() === email && u.id === id);
  if (!user || user.password !== password) return $("#authError").textContent = "อีเมล รหัสนักศึกษา หรือรหัสผ่านไม่ถูกต้อง";
  if (user.status !== "active" || !user.isVerified) return $("#authError").textContent = "บัญชีนี้ยังไม่พร้อมใช้งาน";
  $("#authError").textContent = ""; startSession(user); toast(`ยินดีต้อนรับกลับมา ${user.name}`);
});
$("#showRegister").addEventListener("click", () => { $("#loginForm").classList.add("hidden"); $("#registerForm").classList.remove("hidden"); });
$("#showLogin").addEventListener("click", () => { $("#registerForm").classList.add("hidden"); $("#loginForm").classList.remove("hidden"); });
$("#registerForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#regName").value.trim(); const email = $("#regEmail").value.trim().toLowerCase(); const id = $("#regId").value.trim();
  const password = $("#regPassword").value; const passwordConfirm = $("#regPasswordConfirm").value; const message = $("#regMessage");
  message.classList.remove("form-success"); message.classList.add("form-error");
  if (name.length < 2) return message.textContent = "กรุณากรอกชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร";
  if (!/^[^\s@]+@bumail\.th$/i.test(email)) return message.textContent = "กรุณาใช้อีเมลมหาวิทยาลัย @bumail.th";
  if (!/^\d{10}$/.test(id)) return message.textContent = "กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก";
  if (password.length < 8) return message.textContent = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
  if (password !== passwordConfirm) return message.textContent = "รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน";
  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === email)) return message.textContent = "อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ";
  if (users.some(u => u.id === id)) return message.textContent = "รหัสนักศึกษานี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ";
  const user = { id, email, password, name, status: "active", isVerified: true, createdAt: new Date().toISOString() };
  saveUsers([...users, user]);
  message.classList.remove("form-error"); message.classList.add("form-success"); message.textContent = "สร้างบัญชีสำเร็จ กำลังพาคุณเข้าสู่ BU Park...";
  setTimeout(() => { startSession(user); toast("บัญชีของคุณพร้อมใช้งานแล้ว"); }, 450);
});
$$(".nav-item[data-page], [data-page-go]").forEach(b => b.addEventListener("click", () => goPage(b.dataset.page || b.dataset.pageGo)));
$("#menuToggle").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
$("#logout").addEventListener("click", () => { localStorage.removeItem(SESSION_KEY); $("#appView").classList.add("hidden"); $("#authView").classList.remove("hidden"); $("#password").value = ""; });
$("#notificationButton").addEventListener("click", () => $("#notificationPop").classList.toggle("hidden"));
$("#clearNotifications").addEventListener("click", () => { $("#notificationPop").classList.add("hidden"); toast("ล้างการแจ้งเตือนแล้ว"); });
$("#closeModal").addEventListener("click", () => $("#reserveModal").classList.add("hidden"));
$("#reserveModal").addEventListener("click", e => { if (e.target.id === "reserveModal") e.currentTarget.classList.add("hidden"); });
$$(".time-choice").forEach(b => b.addEventListener("click", () => { $$(".time-choice").forEach(x => x.classList.remove("active")); b.classList.add("active"); }));
$("#confirmReservation").addEventListener("click", () => { const z = zones.find(x => x.id === $("#reserveModal").dataset.zone); z.spaces--; reservation = { zone: z.name.replace("โซน", ""), space: `${z.id}-${String(Math.floor(Math.random()*90+10)).padStart(3,"0")}`, active: true }; $("#reserveModal").classList.add("hidden"); renderZones(); toast(`จอง ${z.name} สำเร็จแล้ว · ${reservation.space}`); goPage("reservation"); });
function navigate() { window.open("https://www.google.com/maps/dir/?api=1&destination=Bangkok+University+Rangsit+Campus", "_blank", "noopener"); toast("กำลังเปิด Google Maps"); }
$("#navigateBtn").addEventListener("click", navigate); $("#navigateBtn2").addEventListener("click", navigate);
$("#cancelReservation").addEventListener("click", () => { if (!reservation.active) return toast("ยังไม่มีการจองที่ใช้งานอยู่"); reservation.active = false; updateScore(-10); toast("ยกเลิกการจองแล้ว · หัก 10 คะแนนจากการยกเลิกกระชั้นชิด"); });
$("#joinWaitlist").addEventListener("click", () => { $("#waitResult").textContent = `คุณอยู่ลำดับที่ 4 ของ ${$("#waitZone").value}`; toast("เพิ่มคุณเข้า Waiting List แล้ว"); });
$("#reportForm").addEventListener("submit", e => { e.preventDefault(); $("#reportResult").textContent = "ส่งรายงานสำเร็จ! หากตรวจสอบได้ คุณจะได้รับ +5 คะแนน"; toast("ขอบคุณที่ช่วยดูแลพื้นที่จอดรถ"); });
$("#mapSearch").addEventListener("input", e => { const term = e.target.value.toLowerCase(); $$(".map-zone-row").forEach(row => row.style.display = row.textContent.toLowerCase().includes(term) ? "grid" : "none"); });
$$(".filter").forEach(b => b.addEventListener("click", () => { $$(".filter").forEach(x => x.classList.remove("active")); b.classList.add("active"); const f = b.dataset.filter; $$(".map-zone-row,.map-pin").forEach(el => { const z = zones.find(x => x.id === el.dataset.zone); el.style.display = f === "all" || z.color === f ? "" : "none"; }); }));
setInterval(() => { if (secondsLeft <= 0) return; secondsLeft--; const m = String(Math.floor(secondsLeft / 60)).padStart(2,"0"), s = String(secondsLeft % 60).padStart(2,"0"); $("#countdown").textContent = `${m}:${s}`; $("#bookingTime").textContent = `เหลือ ${Math.ceil(secondsLeft/60)} นาที`; }, 1000);
restoreSession();
