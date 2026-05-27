import { readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AiUsageRecord } from "./types.js";

import { isObject, numberAt, objectAt, stringAt } from "./utils.js";

const MODELS_DEV_API_URL = "https://models.dev/api.json";
const MODELS_DEV_FETCH_TIMEOUT_MS = 1_000;
const MODELS_DEV_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const MODELS_DEV_CACHE_PATH = join(tmpdir(), "git-snitch-models-dev-api.json");

export interface AiModelPricing {
  readonly input: number;
  readonly output: number;
  readonly cacheRead?: number;
  readonly cacheWrite?: number;
}

export interface AiModelPricingCandidate {
  readonly provider: string;
  readonly model: string;
  readonly name?: string;
  readonly pricing: AiModelPricing;
  readonly fallback: boolean;
}

interface AiModelPricingIndex {
  readonly byModel: ReadonlyMap<string, readonly AiModelPricingCandidate[]>;
}

const FALLBACK_MODEL_PRICES: readonly AiModelPricingCandidate[] = [
  fallbackPrice("openai", "gpt-5.5", "GPT-5.5", { input: 5, cacheRead: 0.5, output: 30 }),
  fallbackPrice("openai", "gpt-5.4", "GPT-5.4", { input: 2.5, cacheRead: 0.25, output: 15 }),
  fallbackPrice("openai", "gpt-5.4-mini", "GPT-5.4 mini", { input: 0.75, cacheRead: 0.075, output: 4.5 }),
  fallbackPrice("opencode", "glm-5.1", "GLM-5.1", { input: 1.4, cacheRead: 0.26, output: 4.4 }),
  fallbackPrice("opencode", "glm-5", "GLM-5", { input: 1, cacheRead: 0.2, output: 3.2 }),
  fallbackPrice("opencode", "glm-5-turbo", "GLM-5-Turbo", { input: 1.2, cacheRead: 0.24, output: 4 }),
  fallbackPrice("opencode", "glm-4.7", "GLM-4.7", { input: 0.6, cacheRead: 0.11, output: 2.2 }),
];

let modelsDevPricingPromise: Promise<AiModelPricingIndex> | undefined;
const FALLBACK_MODEL_PRICE_INDEX = buildPricingIndex(FALLBACK_MODEL_PRICES);

function fallbackPrice(provider: string, model: string, name: string, pricing: AiModelPricing): AiModelPricingCandidate {
  return { provider, model, name, pricing, fallback: true };
}

export async function withEstimatedAiUsageCosts(records: readonly AiUsageRecord[]): Promise<readonly AiUsageRecord[]> {
  if (records.length === 0) {
    return records;
  }

  const pricing = await getModelsDevPricingIndex();
  return records.map((record) => {
    const estimatedCost = estimateAiUsageRecordCostFromIndex(record, pricing);
    return estimatedCost === undefined ? record : { ...record, unsubsidizedCost: estimatedCost };
  });
}

export function estimateAiUsageRecordCost(record: AiUsageRecord, pricingCandidates: readonly AiModelPricingCandidate[] = FALLBACK_MODEL_PRICES): number | undefined {
  return estimateAiUsageRecordCostFromIndex(record, pricingCandidates === FALLBACK_MODEL_PRICES ? FALLBACK_MODEL_PRICE_INDEX : buildPricingIndex(pricingCandidates));
}

function estimateAiUsageRecordCostFromIndex(record: AiUsageRecord, pricingIndex: AiModelPricingIndex): number | undefined {
  const candidate = findPricingCandidate(record, pricingIndex);
  if (candidate === undefined) {
    return undefined;
  }

  const pricing = candidate.pricing;
  const inputCost = record.tokens.input * pricing.input;
  const cacheReadCost = record.tokens.cacheRead * (pricing.cacheRead ?? pricing.input);
  const cacheWriteCost = record.tokens.cacheWrite * (pricing.cacheWrite ?? pricing.input);
  const outputCost = (record.tokens.output + record.tokens.reasoning) * pricing.output;
  return (inputCost + cacheReadCost + cacheWriteCost + outputCost) / 1_000_000;
}

async function getModelsDevPricingIndex(): Promise<AiModelPricingIndex> {
  modelsDevPricingPromise ??= fetchModelsDevPricingCandidates();
  return modelsDevPricingPromise;
}

async function fetchModelsDevPricingCandidates(): Promise<AiModelPricingIndex> {
  try {
    return buildPricingIndex([...FALLBACK_MODEL_PRICES, ...parseModelsDevPricing(JSON.parse(await readModelsDevJson()))]);
  } catch {
    return FALLBACK_MODEL_PRICE_INDEX;
  }
}

async function readModelsDevJson(): Promise<string> {
  const cached = await readFreshModelsDevCache();
  if (cached !== undefined) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODELS_DEV_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(MODELS_DEV_API_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`models.dev returned HTTP ${response.status}`);
    }
    const json = await response.text();
    await writeFile(MODELS_DEV_CACHE_PATH, json, "utf8");
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function readFreshModelsDevCache(): Promise<string | undefined> {
  try {
    const cacheStat = await stat(MODELS_DEV_CACHE_PATH);
    if (Date.now() - cacheStat.mtimeMs > MODELS_DEV_CACHE_MAX_AGE_MS) {
      return undefined;
    }
    return readFile(MODELS_DEV_CACHE_PATH, "utf8");
  } catch {
    return undefined;
  }
}

function buildPricingIndex(candidates: readonly AiModelPricingCandidate[]): AiModelPricingIndex {
  const byModel = new Map<string, AiModelPricingCandidate[]>();
  for (const candidate of candidates) {
    addPricingIndexCandidate(byModel, normalizeModelKey(candidate.model), candidate);
    const nameKey = normalizeModelKey(candidate.name);
    if (nameKey.length > 0) {
      addPricingIndexCandidate(byModel, nameKey, candidate);
    }
  }
  return { byModel };
}

function addPricingIndexCandidate(index: Map<string, AiModelPricingCandidate[]>, key: string, candidate: AiModelPricingCandidate): void {
  const existing = index.get(key);
  if (existing === undefined) {
    index.set(key, [candidate]);
  } else {
    existing.push(candidate);
  }
}

function parseModelsDevPricing(value: unknown): readonly AiModelPricingCandidate[] {
  if (!isObject(value)) {
    return [];
  }

  const candidates: AiModelPricingCandidate[] = [];
  for (const [provider, providerValue] of Object.entries(value)) {
    if (!isObject(providerValue)) {
      continue;
    }
    const models = objectAt(providerValue, "models");
    if (models === undefined) {
      continue;
    }
    for (const modelValue of Object.values(models)) {
      if (!isObject(modelValue)) {
        continue;
      }
      const model = stringAt(modelValue, "id");
      const cost = objectAt(modelValue, "cost");
      const pricing = cost === undefined ? undefined : pricingFromCost(cost);
      if (model !== undefined && pricing !== undefined) {
        candidates.push({ provider, model, name: stringAt(modelValue, "name"), pricing, fallback: false });
      }
    }
  }
  return candidates;
}

function pricingFromCost(cost: Readonly<Record<string, unknown>>): AiModelPricing | undefined {
  const input = numberAt(cost, "input");
  const output = numberAt(cost, "output");
  if (input === undefined || output === undefined || input <= 0 || output <= 0) {
    return undefined;
  }
  const cacheRead = numberAt(cost, "cache_read");
  const cacheWrite = numberAt(cost, "cache_write");
  return {
    input,
    output,
    ...(cacheRead === undefined ? {} : { cacheRead }),
    ...(cacheWrite === undefined ? {} : { cacheWrite }),
  };
}

function findPricingCandidate(record: AiUsageRecord, pricingIndex: AiModelPricingIndex): AiModelPricingCandidate | undefined {
  const modelKey = normalizeModelKey(record.model);
  const providerKey = normalizeProviderKey(record.provider);
  const matches = pricingIndex.byModel.get(modelKey) ?? [];
  if (matches.length === 0) {
    return undefined;
  }

  return [...matches].sort((left, right) => scoreCandidate(record, left, providerKey) - scoreCandidate(record, right, providerKey))[0];
}

function scoreCandidate(record: AiUsageRecord, candidate: AiModelPricingCandidate, providerKey: string | undefined): number {
  const candidateProvider = normalizeProviderKey(candidate.provider);
  if (providerKey !== undefined && !isSubsidizedProvider(providerKey) && candidateProvider === providerKey) {
    return 0;
  }
  if (record.client === "opencode" && candidateProvider === "opencode") {
    return 1;
  }
  if (record.model.toLowerCase().includes("gpt") && candidateProvider === "openai") {
    return 2;
  }
  if (record.model.toLowerCase().includes("glm") && (candidateProvider === "opencode" || candidateProvider === "zhipuai")) {
    return 3;
  }
  return candidate.fallback ? 4 : 5;
}

function isSubsidizedProvider(provider: string): boolean {
  return provider.includes("codingplan") || provider.includes("copilot");
}

function normalizeProviderKey(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function normalizeModelKey(value: string | undefined): string {
  return value?.toLowerCase().replace(/[^a-z0-9]/gu, "") ?? "";
}
