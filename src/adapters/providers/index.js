import { openAICompatibleProvider } from "./openai-compatible.js";
import { anthropicProvider } from "./anthropic.js";
import { googleProvider } from "./google.js";
import { mockProvider } from "./mock.js";

const PROVIDERS = [
  openAICompatibleProvider,
  anthropicProvider,
  googleProvider,
  mockProvider
];

const PROVIDER_BY_ID = new Map();
for (const provider of PROVIDERS) {
  PROVIDER_BY_ID.set(provider.id, provider);
  for (const alias of provider.aliases || []) PROVIDER_BY_ID.set(alias, provider);
}

export function resolveProvider(providerId = "openai-compatible") {
  return PROVIDER_BY_ID.get(String(providerId || "openai-compatible")) || openAICompatibleProvider;
}

export function providerCapabilityTable() {
  return PROVIDERS.map((provider) => ({ id: provider.id, supports: provider.supports() }));
}

export function supportedProviderIds() {
  return [...PROVIDER_BY_ID.keys()];
}

export { openAICompatibleProvider, anthropicProvider, googleProvider, mockProvider };
