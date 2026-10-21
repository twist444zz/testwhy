# BU Smart Parking Full-Stack

React + Vite / Express / SQLite / JWT+bcrypt / Socket.IO.

## Windows
ติดตั้ง Node.js 20+ แล้วดับเบิลคลิก `setup.bat` จากนั้น `start.bat` และเปิด http://localhost:5173

## Demo
Student: `6612345678` / `student@bumail.th` / `password`
Admin: `6600000001` / `admin@bumail.th` / `password`

## Features
Student authentication, @bumail.th validation, dashboard, realtime WebSocket occupancy, campus map, reservations, cancellation, waiting-list API, parking score, history, issue reporting, admin slot management, zone creation, issue resolution.

## Google Maps
ใส่ key ใน `client/.env` ที่ `VITE_GOOGLE_MAPS_API_KEY=` ระบบมี Quick Navigation fallback ไป Google Maps โดยไม่ต้องมี key

## Production
ควรเพิ่ม SSO/Email verification, PostgreSQL/Redis, rate limiting, audit logs, HTTPS, sensor/gate integration, reservation expiry worker และ Google Maps JavaScript/Routes/Places API จริง
