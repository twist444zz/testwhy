# BU Park — Smart Campus Parking

เว็บแอปต้นแบบสำหรับตรวจสอบและจองที่จอดรถภายในมหาวิทยาลัยกรุงเทพ ออกแบบให้เปิดใช้งานได้โดยไม่ต้องติดตั้งแพ็กเกจเพิ่ม

## เริ่มใช้งาน

เปิด `index.html` ในเบราว์เซอร์ หรือเปิดโฟลเดอร์นี้ด้วย Live Server ก็ได้

ตัวอย่างข้อมูลสำหรับเข้าสู่ระบบ:

- อีเมล: `student@bumail.th`
- รหัสนักศึกษา: `6612345678`
- รหัสผ่าน: `password123`

## สิ่งที่มีในเดโม

- Login/Register พร้อมตรวจรูปแบบ `@bumail.th`, รหัสนักศึกษา 10 หลัก และรหัสผ่านอย่างน้อย 8 ตัวอักษร
- สมัครสมาชิกแบบ Auto-Login: ตรวจข้อมูลซ้ำ กำหนดบัญชีเป็น `active` / `isVerified: true` และเข้าสู่ Dashboard ในขั้นตอนเดียว
- Dashboard สถานะช่องจอดรถและตัวนับเวลาแบบเรียลไทม์จำลอง
- แผนที่โซนรังสิตแบบ interactive พร้อมตัวกรอง ค้นหา และจองผ่านพิน
- Modal เลือกเวลามาถึง, Waiting List, รายงานปัญหา และเปิด Google Maps
- ระบบ Parking Score / การหักคะแนนเมื่อยกเลิกกระชั้นชิด
- โปรไฟล์และประวัติการจอดรถ
- Responsive UI สำหรับมือถือและเดสก์ท็อป

## โครงสร้าง

- `index.html` — โครงหน้าจอและ component ของ UI
- `styles.css` — ธีม Dark Glassmorphism และ responsive layout
- `app.js` — state และ interactive behaviours ของ prototype

> หมายเหตุ: ระบบนี้เป็น front-end prototype โดยข้อมูลผู้ใช้และ session ถูกเก็บใน `localStorage` เพื่อจำลองฐานข้อมูลและ session ของระบบจริง หากนำขึ้น production ต้องเก็บรหัสผ่านด้วย password hashing ฝั่ง server, ใช้ secure HTTP-only session cookie และเชื่อม backend/API ที่ปลอดภัย
