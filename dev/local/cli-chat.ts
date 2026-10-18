import { readFileSync } from 'node:fs';

interface KiloConfig {
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
  return config.models?.default ?? 'kilo-auto/free';
}

function getGatewayUrl(config: KiloConfig): string {
  return config.gateway?.url ?? 'https://api.kilo.ai/api/gateway';
}

async function sendChat(
  gatewayUrl: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kilo API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? 'ไม่มีคำตอบกลับมา';
}

async function main() {
  const config = loadConfig();
  const defaultModel = getDefaultModel(config);
  const gatewayUrl = getGatewayUrl(config);
  const modelArg = process.argv[2];
  const model = modelArg ?? defaultModel;

  const messages: ChatMessage[] = [];

  console.log(`=== Kilo CLI Chat ===\nโมเดล: ${model}\nพิมพ์ 'exit' หรือ 'quit' เพื่อออก\nพิมพ์ 'model <id>' เพื่อเปลี่ยนโมเดล\nพิมพ์ 'clear' เพื่อล้างประวัติ\n`);

  let currentModel = model;

  while (true) {
    const input = await readline('> ');

    if (!input.trim()) continue;

    if (input === 'exit' || input === 'quit') {
      console.log('ลากันครับ');
      break;
    }

    if (input === 'clear') {
      messages.length = 0;
      console.log('ล้างประวัติแล้ว\n');
      continue;
    }

    const modelMatch = input.match(/^model\s+(.+)$/i);
    if (modelMatch) {
      currentModel = modelMatch[1].trim();
      console.log(`เปลี่ยนโมเดลเป็น: ${currentModel}\n`);
      continue;
    }

    messages.push({ role: 'user', content: input });

    try {
      const reply = await sendChat(gatewayUrl, currentModel, messages);
      console.log(`\n${reply}\n`);
      messages.push({ role: 'assistant', content: reply });
    } catch (error) {
      console.error(`\nผิดพลาด: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}

function readline(prompt: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    process.stdin.once('data', chunk => {
      resolve(chunk.toString().trim());
    });
  });
}

main().catch(error => {
  console.error(`ผิดพลาดร้ายแรง: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
