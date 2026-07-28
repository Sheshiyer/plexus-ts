import {
  ASSISTANT_RECOMMENDED_LANE,
  normalizeAssistantOmniRouteCatalog,
  type AssistantModelCatalog,
  type AssistantOmniRouteGatewayState,
} from '../shared/native-assistant.js';
import type { AssistantResolvedModelConfig } from './assistant-models.js';
import {
  OmniRouteClientError,
  resolveOmniRouteRelayOrigin,
} from './assistant-omniroute.js';
import {
  fetchOmniRouteWithAccess,
  OmniRouteAccessRequiredError,
} from './teamforge.js';

type EnvLike = Record<string, string | undefined>;

export interface AssistantModelCatalogOptions {
  env?: EnvLike;
  isPackaged?: boolean;
  origin?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
}

function unavailableCatalog(
  state: Exclude<AssistantOmniRouteGatewayState, 'ready'>,
  message: string,
  now: Date,
): AssistantModelCatalog {
  return {
    selectedModelId: null,
    recommendedModelId: ASSISTANT_RECOMMENDED_LANE,
    fallbackModelIds: [],
    entries: [],
    gatewayState: state,
    message,
    generatedAt: now.toISOString(),
  };
}

function gatewayFailure(error: unknown, now: Date): AssistantModelCatalog {
  if (error instanceof OmniRouteAccessRequiredError) {
    return unavailableCatalog(
      'sign_in_required',
      'Sign in to Plexus to load the Temperance lane catalog.',
      now,
    );
  }
  if (error instanceof OmniRouteClientError && error.state === 'sign_in_required') {
    return unavailableCatalog('sign_in_required', error.message, now);
  }
  return unavailableCatalog(
    'offline',
    'The OmniRoute gateway is offline. Retry shortly or check Clio settings.',
    now,
  );
}

export async function discoverAssistantModelCatalog(
  config: AssistantResolvedModelConfig,
  options: AssistantModelCatalogOptions = {},
): Promise<AssistantModelCatalog> {
  const now = options.now?.() ?? new Date();
  let origin: string;
  try {
    origin = options.origin ?? resolveOmniRouteRelayOrigin({
      isPackaged: options.isPackaged ?? true,
      env: options.env,
    });
  } catch (error) {
    return unavailableCatalog(
      'offline',
      error instanceof Error ? error.message : 'OmniRoute relay is not configured.',
      now,
    );
  }

  try {
    const fetchImpl = options.fetch
      ?? ((input: RequestInfo | URL, init?: RequestInit) => fetchOmniRouteWithAccess(
        input,
        init,
        { relayOrigin: origin },
      ));
    const response = await fetchImpl(`${origin}/v1/models`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403) {
      return unavailableCatalog(
        'sign_in_required',
        'Sign in to Plexus to load the Temperance lane catalog.',
        now,
      );
    }
    if (!response.ok) {
      throw new OmniRouteClientError(`OmniRoute catalog HTTP ${response.status}`, {
        status: response.status,
      });
    }
    return normalizeAssistantOmniRouteCatalog(await response.json(), {
      now,
      selectedLaneId: config.laneId,
    });
  } catch (error) {
    return gatewayFailure(error, now);
  }
}
