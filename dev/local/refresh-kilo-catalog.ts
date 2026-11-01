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

    models = payload.data.filter(
      (model): model is GatewayModel =>
        Boolean(model) &&
        typeof model === 'object' &&
        typeof (model as GatewayModel).id === 'string' &&
        (model as GatewayModel).id.length > 0
    );

    if (models.length === 0 || models.length !== payload.data.length) {
      throw new Error('Models endpoint returned an empty list or records with invalid IDs.');
    }

    const ids = models.map(model => model.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error('Models endpoint returned duplicate model IDs; refusing to overwrite the catalog.');
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Models endpoint timed out after ${REQUEST_TIMEOUT_MS} ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const catalogPath = resolve(process.cwd(), '.kilo/models-catalog.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Record<string, any>;
  const providerCounts: Record<string, number> = {};

  for (const model of models) {
    const provider = model.owned_by?.trim() || model.id.split('/')[0] || 'unknown';
    providerCounts[provider] = (providerCounts[provider] ?? 0) + 1;
  }

  const modelIds = new Set(models.map(model => model.id));
  const curatedIds = new Set<string>([
    ...(Array.isArray(catalog.free_models) ? catalog.free_models : []),
    ...(Array.isArray(catalog.available_models?.free) ? catalog.available_models.free : []),
    ...(Array.isArray(catalog.available_models?.premium) ? catalog.available_models.premium : []),
    ...(Array.isArray(catalog.available_models?.auto_routers) ? catalog.available_models.auto_routers : []),
    ...Object.values(catalog.default_models ?? {}).filter(
      (value): value is string => typeof value === 'string'
    ),
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
