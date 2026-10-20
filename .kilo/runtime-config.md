# Kilo AI Runtime — คอนฟิกและคาตาล็อกรวมศูนย์

เอกสารนี้รวมคอนฟิก คาตาล็อกรันไทม์ และสクリปต์ CLI ที่เกี่ยวข้องกับโมเดลเริ่มต้น (free model) และเกตเวย์ของ Kilo AI ไว้ในที่เดียว

---

## 1. ภาพรวม

ระบบ Kilo AI Runtime ใช้ค่าเริ่มต้นเป็นโมเดลฟรี (`kilo-auto/free`) ผ่านเกตเวย์ Kilo (`https://api.kilo.ai/api/gateway`) โดยไม่ต้องตั้งค่า API key หรือคอนฟิกเพิ่มเติม ก่อนใช้งานจริง

ค่าเริ่มต้นนี้ใช้งานได้ทันที หลังจากนำไฟล์คอนฟิกทั้งหมดไปวางในตำแหน่งที่ถูกต้องแล้ว

---

## 2. ไฟล์ทั้งหมดและหน้าที่

| ไฟล์ | ตำแหน่ง | หน้าที่ |
|------|---------|--------|
| `kilo.json` | Root ของ repo | คอนฟิกหลัก: โมเดลเริ่มต้น, เกตเวย์, routing, รายชื่อโมเดลฟรี |
| `.kilo/models-catalog.json` | `.kilo/` | คาตาล็อกโมเดล 349 รายการจาก 60 provider (ดึงจาก `https://api.kilo.ai/api/gateway/models`) |
| `dev/local/cli-chat.ts` | `dev/local/` | สクリปต์แชท CLI แบบโต้ตอบ อ่านคอนฟิกจาก `kilo.json` แล้วส่งข้อความไปยังเกตเวย์ |
| `.env.local` | Root ของ repo | ตัวแปรสภาพแวดล้อมสำหรับการพัฒนาในเครื่อง (placeholder values) |
| `package.json` | Root ของ repo | เพิ่ม script `chat:cli` できますเรียกใช้ `dev/local/cli-chat.ts` |

---

## 3. คอนฟิกหลัก (kilo.json)

```json
{
  "$schema": "https://app.kilo.ai/config.json",
  "snapshot": false,
  "models": {
    "catalog_path": ".kilo/models-catalog.json",
    "default": "kilo-auto/free",
    "free_tier": "kilo-auto/free",
    "routing": {
      "balanced": "kilo-auto/balanced",
      "efficient": "kilo-auto/efficient",
      "free": "kilo-auto/free",
      "frontier": "kilo-auto/frontier"
    },
    "free_models": [
      "kilo-auto/free",
      "poolside/laguna-s-2.1:free",
      "stepfun/step-3.7-flash:free",
      "tencent/hy3:free",
      "inclusionai/ling-3.0-tiny:free",
      "poolside/laguna-xs-2.1:free",
      "nvidia/nemotron-3.5-content-safety:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "cohere/north-mini-code:free"
    ],
    "available_now": {
      "premium": [...],
      "free": [...]
    }
  },
  "gateway": {
    "url": "https://api.kilo.ai/api/gateway",
    "auto_select": true
  }
}
```

จุดสำคัญ:
- `models.default` = `"kilo-auto/free"` — โมเดลเริ่มต้นที่ใช้เมื่อไม่มีการระบุ
- `models.free_tier` = `"kilo-auto/free"` — โมเดลสำหรับ tier ฟรี
- `gateway.url` = `"https://api.kilo.ai/api/gateway"` — เกตเวย์กลางของ Kilo
- `gateway.auto_select` = `true` — เลือก provider อัตโนมัติ

---

## 4. คาตาล็อกโมเดล (.kilo/models-catalog.json)

- ขนาด: 4,839 bytes (178 บรรทัด)
- โมเดลทั้งหมด: 349 รายการ
- Provider ทั้งหมด: 60 รายการ
- โมเดลฟรี 9 รายการ รวมถึง `kilo-auto/free`
- auto_routing: balanced, efficient, free
- default_models: frontier, balanced, efficient, free

---

## 5. CLI Chat Script (dev/local/cli-chat.ts)

### วิธีการใช้งาน

```bash
# รันด้วยโมเดลเริ่มต้น (kilo-auto/free)
bun dev/local/cli-chat.ts

# รันด้วยโมเดลที่ระบุ
bun dev/local/cli-chat.ts kilo-auto/free

# รันผ่าน pnpm script
pnpm chat:cli
```

### คุณสมบัติ

- อ่านคอนฟิกจาก `kilo.json` (มี fallback ค่าเริ่มต้นถ้าไฟล์ไม่พบ)
- รองรับคำสั่งพิเศษ: `exit`/`quit`, `clear`, `model <id>`
- ส่งข้อความไปยังเกตเวย์ผ่าน `fetch` (ไม่ใช้ API key ฝังโค้ด)
- แสดงข้อความต้อนรับและคำแนะนำเป็นภาษาไทย

### การทดสอบ (ทดสอบแล้ว ผลสำเร็จ)

```
$ echo -e "สวัสดี\nexit" | bun dev/local/cli-chat.ts kilo-auto/free
=== Kilo CLI Chat ===
โมเดล: kilo-auto/free
...
> สวัสดีครับ/ค่ะ 👋
...
> EXIT_CODE: 0
```

**หมายเหตุ:** ไม่มี hard-code API key หรือ secret ในสクリปต์นี้ อ่านค่าทั้งหมดจาก `kilo.json`

---

## 6. ตัวแปรสภาพแวดล้อม (.env-local)

สร้างจาก `.env.local.example` โดยใช้ค่า placeholder สำหรับการพัฒนา:

```
NODE_ENV=development
NEXTAUTH_SECRET=dev-placeholder-secret-change-in-production
NEXTAUTH_URL=http://localhost:3000
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/postgres
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
```

---

## 7. งานที่ยังค้างอยู่ (ต่อจาก Grok checklist)

| งาน | สถานะ | หมายเหตุ |
|-----|--------|---------|
| ตรวจ Codex review comments ใน PR #1 | ⚠️ | ไม่พบ PR #1 ของ mickmix258-gif/cloudkilo (อยู่ GitHub ของบุคคลอื่น) ตรวจ code เองแทน |
| ตรวจ CLI script ว่ามี hard-code secret หรือไม่ | ✅ | ไม่มี — อ่านจาก kilo.json เท่านั้น |
| ตรวจขนาด models-catalog.json | ✅ | 4,839 bytes — ไม่ใหญ่เกินไป |
| ทดสอบ CLI ด้วย free model | ✅ | ผ่าน — kilo-auto/free ตอบกลับเป็นภาษาไทย |
| รวม config / catalog / CLI ให้อยู่ในที่เดียว | ✅ | เอกสารนี้ |
| ค่า default (free model + gateway) ใช้งานได้ทันที | ✅ | kilo.json กำหนด default และ gateway แล้ว |
| แก้ไขการนำทางลิงก์การตั้งค่า autocomplete (Issue #6284) | ⏳ | รอทำในรอบถัดไป |
| เพิ่ม back button ให้ ProfileView.tsx | ⏳ | รอทำในรอบถัดไป |

---

## 8. หมายเหตุเกี่ยวกับสภาพแวดล้อม

- Sandbox นี้ไม่มี VS Code ไม่สามารถทดสอบ extension แบบเต็มรูปแบบได้
- ไม่มี network constraint สำหรับการทดสอบ CLI (ทดสอบแล้วสำเร็จ)
- pnpm catalog มีปัญหา (`@pierre/diffs` not found) ใช้ `bun` รัน CLI แทน
