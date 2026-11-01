# Kilo AI Runtime — สถานะคอนฟิกและวิธีใช้งาน

อัปเดตเอกสาร: 1 พฤศจิกายน 2026

เอกสารนี้อธิบายเฉพาะส่วน Kilo AI Runtime และ CLI Chat ที่อยู่ใน Repository `cloudkilo` ไม่ใช่การรับรองว่า Kilo Code VS Code Extension ทั้งชุดพร้อมใช้งานแล้ว

## 1. สรุปสถานะปัจจุบัน

- โมเดลเริ่มต้น: `kilo-auto/free`
- Gateway base URL: `https://ai-gateway.kilo.ai/api/v1`
- CLI command: `pnpm chat:cli`
- Authentication: ใช้ `KILO_API_KEY` จาก environment สำหรับโมเดลที่ต้องยืนยันตัวตน
- Anonymous access: ใช้ได้เฉพาะโมเดลที่ Gateway อนุญาตให้ใช้ฟรี และมี rate limit
- Model catalog: เป็น historical snapshot ที่สร้างเมื่อ `2026-08-08T15:04:40.667410Z` ไม่ใช่รายการสด
- VS Code Extension source: เก็บไว้ใน `packages/kilo-vscode/` แต่ถูก exclude จาก pnpm workspace ชั่วคราว เพราะ dependency graph จาก upstream ยังไม่ครบ

## 2. ไฟล์หลัก

| ไฟล์ | หน้าที่ |
|---|---|
| `kilo.json` | กำหนดโมเดลเริ่มต้นและ Gateway URL |
| `.kilo/models-catalog.json` | สรุปจำนวน Provider, routing และรายการโมเดลที่คัดเลือกไว้ |
| `.kilo/runtime-config.md` | เอกสาร Runtime ฉบับนี้ |
| `dev/local/cli-chat.ts` | วงจรรับคำสั่งจาก Terminal |
| `dev/local/cli-chat-core.ts` | ฟังก์ชันเลือกโมเดล, สร้าง Header และเรียก Gateway |
| `dev/local/cli-chat.test.ts` | Unit tests สำหรับ CLI core |
| `package.json` | คำสั่ง `chat:cli` และ `catalog:refresh` |
| `packages/kilo-vscode/` | Source snapshot ของ VS Code Extension ซึ่งยังไม่ใช่ workspace package ที่ build ได้ใน Repository นี้ |

## 3. การตั้งค่าและใช้งาน CLI

ใช้ Node.js ตามข้อกำหนดใน root `package.json` และติดตั้ง dependencies ของ Repository ก่อน

```bash
pnpm install --frozen-lockfile
pnpm chat:cli
```

กำหนด API key ใน environment ของ Shell หรือ Secret Manager ก่อนใช้โมเดลที่ต้องยืนยันตัวตน:

```bash
export KILO_API_KEY="ใส่คีย์ของคุณในเครื่องเท่านั้น"
pnpm chat:cli
```

ห้าม commit API key ลง Git, ห้ามใส่ใน `kilo.json`, source code, issue หรือ Pull Request

คำสั่งภายใน CLI:

- `model <id>` — เปลี่ยน Model ID สำหรับข้อความถัดไป
- `clear` — ล้างประวัติสนทนาในหน่วยความจำของ CLI
- `exit` หรือ `quit` — จบเซสชัน

CLI นี้เป็น text-chat helper แบบ OpenAI-compatible ไม่ใช่ Agent เต็มรูปแบบ: ยังไม่มี tool calling, streaming, persistent conversation storage หรือการเรียกใช้เครื่องมือใน Repository

## 4. Gateway และ Authentication

Gateway API ที่เอกสารทางการระบุ:

- Base URL: `https://ai-gateway.kilo.ai/api/v1`
- Chat: `POST /chat/completions`
- Models: `GET /models`
- Providers: `GET /providers`

การเรียกโมเดลที่ต้องยืนยันตัวตนใช้ `Authorization: Bearer $KILO_API_KEY` ส่วน anonymous access จำกัดเฉพาะ Free Models และมี rate limit ตาม IP

แหล่งอ้างอิง:
- https://kilo.ai/docs/gateway/api-reference
- https://kilo.ai/docs/gateway/authentication
- https://kilo.ai/docs/gateway/models-and-providers

## 5. ข้อควรระวังเรื่อง Free Models

Free ไม่ได้แปลว่าเหมาะกับข้อมูลลับหรือข้อมูลลูกค้าเสมอไป เอกสาร Kilo ระบุว่า Free Models อาจถูกจำกัดอัตราการใช้งาน และ Auto Free อาจ route ไปยัง Provider ที่บันทึก Prompt/Output หรือใช้ข้อมูลเพื่อปรับปรุงบริการได้

- ห้ามส่ง Password, API key, Source Code ที่เป็นความลับ, ข้อมูลลูกค้า หรือข้อมูลส่วนบุคคลที่ไม่จำเป็น
- ตรวจสอบเงื่อนไขการเก็บข้อมูลของ Provider ปลายทางก่อนใช้งาน
- ตรวจสอบราคาและสถานะโมเดลก่อนเลือกโมเดลแบบเสียค่าใช้จ่าย

## 6. Model Catalog: ข้อจำกัดและการ Refresh

ไฟล์ `.kilo/models-catalog.json` เดิมระบุจำนวนรวม 349 โมเดลจาก 60 Provider แต่ในไฟล์มีเพียง aggregate provider counts, routing tiers และ curated model IDs ไม่ได้ฝังข้อมูลรายละเอียดครบ 349 โมเดล

Timestamp เดิมคือ `2026-08-08T15:04:40.667410Z` จึงไม่ควรถือว่าเป็นรายการปัจจุบัน

Refresh จาก Gateway ได้ด้วย:

```bash
pnpm catalog:refresh
```

สคริปต์จะดึง `GET https://ai-gateway.kilo.ai/api/v1/models` และบันทึก full model records พร้อมเวลา Refresh ลง `.kilo/models-catalog.json` โดยจะเก็บ curated lists เดิมไว้และรายงาน ID ที่ไม่พบในรายการสด ไม่ควรนำ curated lists ไปใช้เป็นหลักฐานราคา/Availability โดยไม่ตรวจสอบอีกครั้ง

## 7. สถานะ Kilo VS Code Extension

`packages/kilo-vscode/` มี source snapshot ขนาดใหญ่จาก Kilo Code แต่ manifest อ้างอิง Workspace Packages จาก upstream ที่ไม่มีอยู่ใน Repository นี้ เช่น SDK, core และ UI packages ที่ Codex ระบุ

เพื่อป้องกันไม่ให้ `pnpm install --frozen-lockfile` ของ CloudKilo ล้มเหลว จึง exclude `packages/kilo-vscode` จาก root pnpm workspace ชั่วคราว

ผลที่ตามมา:
- Source files ยังอยู่ใน Git และตรวจสอบได้
- ไม่ได้ลบหรือทำลาย source snapshot
- ห้ามอ้างว่า Extension build ได้จาก CloudKilo checkout ปัจจุบัน
- ก่อนเปิดใช้งาน ต้องนำ dependency graph ที่ตรงกับ upstream version เข้ามาให้ครบ, regenerate lockfile และทดสอบ VS Code Extension Host

## 8. การตรวจสอบที่ต้องทำ

| รายการ | สถานะ |
|---|---|
| CLI request timeout | แก้ใน source |
| CLI serial input / multi-line stdin | แก้ใน source |
| CLI graceful EOF / shutdown | แก้ใน source |
| CLI history consistency on failed request | แก้ใน source |
| Optional Bearer authentication via `KILO_API_KEY` | แก้ใน source |
| CLI core unit tests | เพิ่มแล้ว; ต้องรันใน CI |
| Exclude incomplete Extension from pnpm workspace | แก้ใน source |
| Live model catalog refresh script | เพิ่มแล้ว; ต้องรันใน environment ที่เข้าถึง Gateway ได้ |
| Clean install with frozen lockfile | รอ CI ยืนยัน |
| Full repository tests and lint | รอ CI ยืนยัน |
| VS Code Extension build and manual tests | ยังไม่พร้อมจนกว่าจะเติม upstream dependencies |

ห้ามถือว่า Build, Tests หรือ CI ผ่านจนกว่าจะมีผลลัพธ์จริงจาก GitHub Actions หรือการรันทดสอบในเครื่อง
