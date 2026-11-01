# Mercury Next Edit — การตั้งค่าและบันทึกการทดสอบ

## สถานะการติดตั้งในสภาพแวดล้อม Cloud Agent Sandbox

### ขั้นตอนที่ทำสำเร็จ

1. **อัปเกรด Bun** — จาก 1.3.14 → 1.4.3 (ต้องการ ≥ 1.4.2)
2. **เพิ่ม remote Kilo-Org** — `git remote add kilo-org https://github.com/Kilo-Org/kilocode.git`
3. **ดึง PR #10536** — `git fetch kilo-org pull/10536/head:mercury-next-edit-integration`
4. **สลับสาขา** — `git checkout mercury-next-edit-integration` (ใช้ `-f` เนื่องจากไฟล์ LFS ขัดแย้ง)
5. **ติดตั้ง dependencies** — `bun install --ignore-scripts` (ข้าม native scripts เนื่องจากไม่มี Python)
6. **เริ่ม build SDK** — `bun run rebuild-sdk` สำเร็จ (SDK gen อัปเดตแล้ว)
7. **เริ่ม build Extension** — `bun run watch` เริ่มทำงานแต่ใช้เวลานาน (build opencode dependencies)

### ข้อจำกัดในสภาพแวดล้อมนี้

| รายการ | สถานะ | เหตุผล |
|--------|--------|--------|
| VS Code | ❌ ไม่มี | ติดตั้ง VS Code ไม่ได้ใน sandbox |
| Extension Dev Host | ❌ ไม่สามารถเปิดได้ | ต้องการ VS Code |
| Python | ❌ ไม่มี | ต้องการสำหรับ node-gyp (native modules) |
| Git LFS images | ⚠️ ข้าม | ใช้ `--skip-smudge` เนื่องจากไฟล์ GIF ขนาดใหญ่ไม่มีบน server |

### การทดสอบ Mercury Next Edit

**ไม่สามารถทดสอบได้ในสภาพแวดล้อมนี้** เนื่องจากต้องการ:
- VS Code ≥ 1.105.1
- Extension Development Host
- Inception API Key (`sk_...`)

### ขั้นตอนที่ต้องทำเมื่อมี VS Code

```bash
# 1. ติดตั้ง Bun ≥ 1.4.2
curl -fsSL https://bun.sh/install | bash

# 2. Clone และ checkout PR
git clone https://github.com/Kilo-Org/kilocode.git
cd kilocode
git fetch origin pull/10536/head:mercury-next-edit-integration
git checkout mercury-next-edit-integration

# 3. ติดตั้ง dependencies
bun install

# 4. เริ่ม build
cd packages/kilo-vscode
bun run watch

# 5. เปิด VS Code → F5 (Extension Development Host)

# 6. เปิดโฟลเดอร์ทดสอบ
# File → Open Folder → packages/kilo-vscode/docs/nes-examples/

# 7. กำหนดค่า NES ใน Settings
# model → Mercury Next Edit (Inception)
# nextEdit.apiKey → ใส่ Inception API Key
# enableAutoTrigger → ✓

# 8. ดู log pipeline
# View → Output → "Kilo Code · Next Edit"

# 9. ทดสอบกรณีทั้ง 20 ตามเอกสาร
```

### การตั้งค่า NES (Settings Reference)

| Setting | ค่า |
|---------|-----|
| `kilo-code.new.autocomplete.model` | `Mercury Next Edit (Inception)` |
| `kilo-code.new.autocomplete.nextEdit.apiKey` | `sk_...` (Inception API Key) |
| `kilo-code.new.autocomplete.enableAutoTrigger` | `true` |
| `kilo-code.new.autocomplete.nextEdit.baseUrl` | `https://api.inceptionlabs.ai/v1` (ตัวเลือก) |
| `kilo-code.new.autocomplete.nextEdit.debug` | `true` (ตัวเลือก, แสดง log ใน DevTools) |

### กรณีทดสอบทั้ง 20 (NES Test Cases)

**Python — Core (5)**
1. Finish recursive function body (same-line ghost)
2. Pattern continuation (same-line ghost)
3. Mid-identifier completion (same-line ghost)
4. Loop body inference (same-line ghost)
5. Sibling method body (same-line ghost)

**Python — Advanced (4)**
7. Multi-line rename refactor (off-cursor decoration)
8. Mixed insert + replace (off-cursor decoration)
10. Mid-token completion (same-line ghost)
11. Stub method with siblings (same-line ghost)
12. Type annotation insertion (same-line/off-cursor)
13. Docstring generation (same-line ghost)
14. No-op suppression (negative case)

**TypeScript (3)**
ts_07. Array transform completion (same-line ghost)
ts_08. Param type annotations (off-cursor decoration)
ts_09. React event handler (same-line ghost)

**Go (3)**
go_07. Error handling block (same-line ghost)
go_08. Struct method body (same-line ghost)
go_09. Goroutine + channel (same-line ghost)

**Rust (3)**
rs_07. Match-arm completion (same-line ghost)
rs_08. Result/Option chaining (same-line ghost)
rs_09. Lifetime annotations (off-cursor decoration)

**JavaScript (2)**
js_07. Async/await fetch (same-line ghost)
js_08. Express GET handler (same-line ghost)

**SQL (2)**
sql_07. Missing JOIN (same-line ghost)
sql_08. WHERE filter (same-line ghost)

**Markdown — Negative Case (1)**
md_07. Prose should stay quiet (nothing should render)

---

**เวลาที่คาดการณ์ทั้งหมด: 17 ชั่วโมง**
- ติดตั้ง PR ในเครื่อง: 3 ชั่วโมง
- กำหนดค่า settings: 1 ชั่วโมง
- ทดสอบกรณี 20: 10 ชั่วโมง
- บันทึกผล: 3 ชั่วโมง

**สถานะปัจจุบัน: ทำขั้นตอน 1–2 สำเร็จ, ขั้นตอน 3–4 ไม่สามารถทำได้ (ไม่มี VS Code)**
