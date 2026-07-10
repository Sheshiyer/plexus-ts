import { describe, expect, it } from 'vitest';
import {
  deriveProjectMediaHonesty,
  deriveSfuLiveTransportAcceptance,
} from '../../src/renderer/lib/coworkingModel';

describe('coworking SFU live transport acceptance', () => {
  it('keeps project media pending until true live SFU proof exists', () => {
    const acceptance = deriveSfuLiveTransportAcceptance({
      transportState: 'deferred',
      liveProofVerified: false,
    });

    expect(acceptance).toMatchObject({
      liveProofRequired: true,
      liveProofVerified: false,
      localFallbackAccepted: true,
      status: 'pending_live_proof',
      acceptanceCopy: 'True live SFU proof required before enabling project media; local visual fallback is not live proof.',
      fallbackBoundary: 'Presence and track metadata recorded; live SFU media is not connected.',
    });
    expect(acceptance.proofBoundary).toContain('configured Cloudflare');
    expect(acceptance.proofBoundary).toContain('remote stream receipt');
    expect(deriveProjectMediaHonesty({ activeProjectJoin: true, transportReady: false })).toMatchObject({
      gated: true,
      proofCopy: 'SFU live proof pending; local visual fallback is not live proof.',
    });
  });

  it('separates verified live proof from degraded fallback', () => {
    expect(deriveSfuLiveTransportAcceptance({
      transportState: 'ready',
      liveProofVerified: true,
    })).toMatchObject({
      status: 'verified',
      liveProofVerified: true,
      acceptanceCopy: 'True live SFU transport proof is verified.',
    });

    expect(deriveSfuLiveTransportAcceptance({
      transportState: 'degraded',
      liveProofVerified: false,
    })).toMatchObject({
      status: 'degraded_fallback',
      liveProofVerified: false,
      fallbackBoundary: 'Presence and track metadata recorded; live SFU media is not connected.',
    });
  });
});
