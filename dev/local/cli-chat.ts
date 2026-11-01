import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import {
  getDefaultModel,
  getGatewayUrl,
  sendChat,
  type ChatMessage,
  type KiloConfig,
} from './cli-chat-core';

function loadConfig(): KiloConfig {
  const configPath = resolve(process.cwd(), 'kilo.json');
  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('kilo.json must contain a JSON object.');
    }
    return parsed as KiloConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw new Error(
      `Unable to read ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const gatewayUrl = getGatewayUrl(config);
  let currentModel = process.argv[2]?.trim() || getDefaultModel(config);
  const apiKey = process.env.KILO_API_KEY;
  const messages: ChatMessage[] = [];
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: interactive,
  });
  rl.setPrompt('> ');
  let inputClosed = false;
  rl.on('close', () => {
    inputClosed = true;
  });
  const showPrompt = (): void => {
    if (interactive && !inputClosed) rl.prompt();
  };

  console.log(
    [
      '=== Kilo CLI Chat ===',
      `โมเดล: ${currentModel}`,
      "พิมพ์ 'exit' หรือ 'quit' เพื่อออก",
      "พิมพ์ 'model <id>' เพื่อเปลี่ยนโมเดล",
      "พิมพ์ 'clear' เพื่อล้างประวัติ",
      apiKey ? 'พบ KILO_API_KEY แล้ว' : 'ยังไม่มี KILO_API_KEY: ใช้งานได้เฉพาะโมเดลที่อนุญาตแบบไม่ยืนยันตัวตน',
      '',
    ].join('\n')
  );

  showPrompt();

  try {
    // Async iteration processes each input line in order and naturally waits
    // for each request before accepting the next command.
    for await (const rawLine of rl) {
      const input = rawLine.trim();

      if (!input) {
        showPrompt();
        continue;
      }

      if (input === 'exit' || input === 'quit') {
        console.log('ลากันครับ');
        break;
      }

      if (input === 'clear') {
        messages.length = 0;
        console.log('ล้างประวัติแล้ว\n');
        showPrompt();
        continue;
      }

      const modelMatch = input.match(/^model\s+(.+)$/i);
      if (modelMatch) {
        currentModel = modelMatch[1].trim();
        console.log(`เปลี่ยนโมเดลเป็น: ${currentModel}\n`);
        showPrompt();
        continue;
      }

      try {
        const reply = await sendChat(
          gatewayUrl,
          currentModel,
          [...messages, { role: 'user', content: input }],
          { apiKey }
        );
        messages.push({ role: 'user', content: input });
        messages.push({ role: 'assistant', content: reply });
        console.log(`\n${reply}\n`);
      } catch (error) {
        console.error(
          `\nผิดพลาด: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }

      showPrompt();
    }
  } finally {
    rl.close();
    console.log('จบเซสชันแล้ว');
  }
}

main().catch(error => {
  console.error(
    `ผิดพลาดร้ายแรง: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
