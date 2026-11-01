import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODELS_URL = 'https://ai-gateway.kilo.ai/api/v1/models';
const REQUEST_TIMEOUT_MS = 30_000;

interface GatewayModel {
  id: string;
  owned_by?: string;
  [key: string]: unknown;
}

interface ModelsResponse {
  data?: unknown;
}

interface CatalogFile {
  generated_at_utc?: string;
  source?: Record<string, unknown>;
  catalog_summary?: {
    model_count?: number;
    provider_count?: number;
    providers?: Record<string, number>;
    [key: string]: unknown;
  };
  free_models?: string[];
  available_models?: {
    free?: string[];
    premium?: string[];
    auto_routers?: string[];
    [key: string]: unknown;
  };
  default_models?: Record<string, string>;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let models: GatewayModel[];
  try {
    const response = await fetch(MODELS_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Models endpoint returned HTTP ${response.status}: ${response.statusText}`);
    }

    const payload = (await response.json()) as ModelsResponse;
    if (!Array.isArray(payload.data)) {
      throw new Error('Models endpoint response does not contain a data array.');
    }

    const records: GatewayModel[] = [];
    for (const candidate of payload.data as unknown[]) {
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        typeof (candidate as Record<string, unknown>).id !== 'string' ||
        !(candidate as Record<string, unknown>).id
      ) {
        throw new Error('Models endpoint returned a record with an invalid model ID.');
      }
      records.push(candidate as GatewayModel);
    }

    if (records.length === 0) {
      throw new Error('Models endpoint returned an empty model list.');
    }

    const ids = records.map(model => model.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error('Models endpoint returned duplicate model IDs; refusing to overwrite the catalog.');
    }
    models = records;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Models endpoint timed out after ${REQUEST_TIMEOUT_MS} ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const catalogPath = resolve(process.cwd(), '.kilo/models-catalog.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as CatalogFile;
  const providerCounts: Record<string, number> = {};

  for (const model of models) {
    const provider = model.owned_by?.trim() || model.id.split('/')[0] || 'unknown';
    providerCounts[provider] = (providerCounts[provider] ?? 0) + 1;
  }

  const modelIds = new Set(models.map(model => model.id));
  const curatedIds = new Set<string>([
    ...(catalog.free_models ?? []),
    ...(catalog.available_models?.free ?? []),
    ...(catalog.available_models?.premium ?? []),
    ...(catalog.available_models?.auto_routers ?? []),
    ...Object.values(catalog.default_models ?? {}),
  ]);
  const missingCuratedIds = [...curatedIds].filter(id => !modelIds.has(id)).sort();

  const generatedAt = new Date().toISOString();
  catalog.generated_at_utc = generatedAt;
  catalog.source = {
    ...(catalog.source ?? {}),
    type: 'official_runtime_catalog',
    url: MODELS_URL,
    documentation: 'https://kilo.ai/docs/gateway/api-reference',
  };
  catalog.catalog_summary = {
    ...(catalog.catalog_summary ?? {}),
    model_count: models.length,
    provider_count: Object.keys(providerCounts).length,
    providers: Object.fromEntries(
      Object.entries(providerCounts).sort(([a], [b]) => a.localeCompare(b))
    ),
  };
  catalog.live_catalog = {
    generated_at_utc: generatedAt,
    source_url: MODELS_URL,
    models,
  };
  catalog.catalog_status = {
    kind: 'live_snapshot',
    generated_at_utc: generatedAt,
    contains_full_model_records: true,
    refresh_required: false,
    missing_curated_model_ids: missingCuratedIds,
  };

  const temporaryPath = `${catalogPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  renameSync(temporaryPath, catalogPath);

  console.log(
    `Updated ${catalogPath}: ${models.length} models, ${Object.keys(providerCounts).length} providers.`
  );
  if (missingCuratedIds.length > 0) {
    console.warn('Curated IDs not present in the live model list:', missingCuratedIds.join(', '));
  }
}

main().catch(error => {
  console.error(`Catalog refresh failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
