import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

interface KiloConfig {
  model?: string;
  models?: {
    default?: string;
    free_tier?: string;
    routing?: Record<string, string>;
    free_models?: string[];
  };
  gateway?: {
    url?: string;
    auto_select?: boolean;
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function loadConfig(): KiloConfig {
  try {
    const raw = readFileSync('kilo.json', 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      model: 'kilo-auto/free',
      models: {
        default: 'kilo-auto/free',
        free_tier: 'kilo-auto/free',
        routing: {
          balanced: 'kilo-auto/balanced',
          efficient: 'kilo-auto/efficient',
          free: 'kilo-auto/free',
          frontier: 'kilo-auto/frontier',
        },
      },
      gateway: { url: 'https://api.kilo.ai/api/gateway', auto_select: true },
    };
  }
}

function getDefaultModel(config: KiloConfig): string {
  // อ่านจาก top-level `model` ก่อน แล้วค่อย fallback ไปยัง `models.default`
  return config.model ?? config.models?.default ?? 'kilo-auto/free';
}

function getGatewayUrl(config: KiloConfig): string {
  return config.gateway?.url ?? 'https://api.kilo.ai/api/gateway';
}

async function sendChat(
  gatewayUrl: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${gatewayUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kilo API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? 'ไม่มีคำตอบกลับมา';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('หมดเวลารอคำตอบจาก gateway (เกิน 30 วินาที) โปรดลองใหม่อีกครั้ง');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  const config = loadConfig();
  const defaultModel = getDefaultModel(config);
  const gatewayUrl = getGatewayUrl(config);
  const modelArg = process.argv[2];
  const model = modelArg ?? defaultModel;

  const messages: ChatMessage[] = [];

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  console.log(`=== Kilo CLI Chat ===\nโมเดล: ${model}\nพิมพ์ 'exit' หรือ 'quit' เพื่อออก\nพิมพ์ 'model <id>' เพื่อเปลี่ยนโมเดล\nพิมพ์ 'clear' เพื่อล้างประวัติ\n`);

  let currentModel = model;

  rl.on('line', (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === 'exit' || input === 'quit') {
      console.log('ลากันครับ');
      rl.close();
      return;
    }

    if (input === 'clear') {
      messages.length = 0;
      console.log('ล้างประวัติแล้ว\n');
      rl.prompt();
      return;
    }

    const modelMatch = input.match(/^model\s+(.+)$/i);
    if (modelMatch) {
      currentModel = modelMatch[1].trim();
      console.log(`เปลี่ยนโมเดลเป็น: ${currentModel}\n`);
      rl.prompt();
      return;
    }

    // ส่งข้อความ — push เข้า history เฉพาะเมื่อส่งสำเร็จเท่านั้น
    (async () => {
      try {
        const reply = await sendChat(gatewayUrl, currentModel, [
          ...messages,
          { role: 'user', content: input },
        ]);
        console.log(`\n${reply}\n`);
        // Push ลง history หลังจาก sendChat สำเร็จแล้วเท่านั้น
        messages.push({ role: 'user', content: input });
        messages.push({ role: 'assistant', content: reply });
      } catch (error) {
        console.error(`\nผิดพลาด: ${error instanceof Error ? error.message : String(error)}\n`);
      }
      rl.prompt();
    })();
  });

  rl.on('close', () => {
    console.log('จบเซสชันแล้ว');
    process.exit(0);
  });

  rl.prompt();
}

main().catch(error => {
  console.error(`ผิดพลาดร้ายแรง: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
