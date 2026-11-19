import { useEffect, useMemo, useState } from 'react';

type Disposition = 'adapt' | 'reference' | 'hold' | 'duplicate';
type Family = 'telegram-mini-app' | 'r3f';

type Asset = {
  sourceId: string;
  organizedPath: string;
  originalFilename: string;
  family: Family | string;
  category: string;
  semanticOwner: string | null;
  identityConfidence: string;
  duplicateOf: string | null;
  sha256: string;
  dimensions: { width: number; height: number };
  authority: string;
  title: string;
  observed: string;
  translation: string;
  avoid: string;
  pages: string[];
  disposition: Disposition;
  inspection: 'direct-visual' | 'map-and-contact-sheet' | 'exact-hash-duplicate' | string;
};

type Manifest = {
  sourceMapSha256: string;
  counts: {
    sourceAssets: number;
    telegramMiniApp: number;
    r3f: number;
    duplicateAssets: number;
    unresolvedModels: number;
  };
  assets: Asset[];
};

type Props = { onNavigate: (page: string) => void };

const dispositionLabels: Record<Disposition, string> = {
  adapt: 'Adapt',
  reference: 'Reference',
  hold: 'Hold',
  duplicate: 'Duplicate',
};

function displayFamily(family: string) {
  return family === 'telegram-mini-app' ? 'Telegram' : family === 'r3f' ? 'R3F' : family;
}

function assetSearchText(asset: Asset) {
  return [
    asset.sourceId,
    asset.title,
    asset.organizedPath,
    asset.originalFilename,
    asset.family,
    asset.category,
    asset.semanticOwner ?? '',
    ...asset.pages,
  ].join(' ').toLowerCase();
}

function AssetStatus({ disposition }: { disposition: Disposition }) {
  return <span className={`source-library-status disposition-${disposition}`}>{dispositionLabels[disposition]}</span>;
}

function LoadingState() {
  return (
    <div className="source-library-state" role="status" aria-live="polite">
      <span className="source-library-kicker">Source library</span>
      <strong>Loading reference manifest…</strong>
      <p>Reading the local Cambium source map. Images remain reference-only.</p>
    </div>
  );
}

function MissingSourceState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="source-library-state source-library-state-error" role="alert">
      <span className="source-library-kicker">Source library unavailable</span>
      <strong>Reference manifest could not be read.</strong>
      <p>{message}</p>
      <button className="source-library-button source-library-button-primary" type="button" onClick={onRetry}>Retry source read</button>
    </div>
  );
}

export default function SourceLibrary({ onNavigate }: Props) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<'all' | Family>('all');
  const [disposition, setDisposition] = useState<'all' | Disposition>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageErrorFor, setImageErrorFor] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    if (!signal.aborted) {
      setLoading(true);
      setError(null);
    }

    fetch('/__cambium/manifest', { signal })
      .then(async (response) => {
        if (!response.ok) {
          let serverError: string | null = null;
          try {
            const body = await response.json() as { error?: unknown; message?: unknown };
            if (typeof body.error === 'string') serverError = body.error;
            else if (typeof body.message === 'string') serverError = body.message;
          } catch {
            // Preserve the HTTP status when the error body is not JSON.
          }
          throw new Error(`Source manifest returned HTTP ${response.status}${serverError ? `: ${serverError}` : '.'}`);
        }
        const value = await response.json() as Partial<Manifest>;
        if (signal.aborted) return;
        if (!Array.isArray(value.assets) || !value.counts || typeof value.sourceMapSha256 !== 'string') {
          throw new Error('Source manifest has an incomplete shape.');
        }
        if (!signal.aborted) {
          setManifest(value as Manifest);
          setSelectedId(value.assets[0]?.sourceId ?? null);
        }
      })
      .catch((reason: unknown) => {
        if (signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return;
        if (!signal.aborted) {
          setManifest(null);
          setSelectedId(null);
          setError(reason instanceof Error ? reason.message : 'The source manifest could not be read.');
        }
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [retryTick]);

  const filteredAssets = useMemo(() => {
    if (!manifest) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return manifest.assets.filter((asset) => (
      (family === 'all' || asset.family === family)
      && (disposition === 'all' || asset.disposition === disposition)
      && (!normalizedQuery || assetSearchText(asset).includes(normalizedQuery))
    ));
  }, [disposition, family, manifest, query]);

  useEffect(() => {
    if (!filteredAssets.some((asset) => asset.sourceId === selectedId)) {
      setSelectedId(filteredAssets[0]?.sourceId ?? null);
    }
  }, [filteredAssets, selectedId]);

  useEffect(() => setImageErrorFor(null), [selectedId]);

  const selected = filteredAssets.find((asset) => asset.sourceId === selectedId) ?? null;
  const resetFilters = () => {
    setQuery('');
    setFamily('all');
    setDisposition('all');
  };

  if (loading && !manifest) return <section className="source-library"><LoadingState /></section>;
  if (error || !manifest) {
    return <section className="source-library"><MissingSourceState message={error ?? 'No source manifest is available.'} onRetry={() => setRetryTick((value) => value + 1)} /></section>;
  }

  return (
    <section className="source-library" aria-label="Cambium source library">
      <header className="source-library-header">
        <div>
          <span className="source-library-kicker">Reference-only visual evidence</span>
          <h1>Source library</h1>
          <p>Inspect the original Cambium assets and how each one translates into Plexus.</p>
        </div>
        <div className="source-library-summary" aria-label="Source counts">
          <strong>{manifest.counts.sourceAssets}</strong>
          <span>assets mapped</span>
          <small>{manifest.counts.telegramMiniApp} Telegram · {manifest.counts.r3f} R3F</small>
        </div>
      </header>

      <div className="source-library-toolbar">
        <label className="source-library-search">
          <span>Search source assets</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, source ID, category…" />
        </label>
        <label>
          <span>Family</span>
          <select value={family} onChange={(event) => setFamily(event.target.value as 'all' | Family)}>
            <option value="all">All families</option>
            <option value="telegram-mini-app">Telegram</option>
            <option value="r3f">R3F</option>
          </select>
        </label>
        <label>
          <span>Disposition</span>
          <select value={disposition} onChange={(event) => setDisposition(event.target.value as 'all' | Disposition)}>
            <option value="all">All dispositions</option>
            {(Object.keys(dispositionLabels) as Disposition[]).map((key) => <option value={key} key={key}>{dispositionLabels[key]}</option>)}
          </select>
        </label>
        <span className="source-library-result-count" role="status" aria-live="polite">{filteredAssets.length} shown</span>
        <button className="source-library-button" type="button" onClick={resetFilters} disabled={!query && family === 'all' && disposition === 'all'}>Reset filters</button>
      </div>

      <div className="source-library-layout">
        <nav className="source-library-list" aria-label="Source assets">
          {filteredAssets.length === 0 && <div className="source-library-empty"><strong>No matching source assets.</strong><span>Reset filters or try a broader search.</span><button className="source-library-button" type="button" onClick={resetFilters}>Reset filters</button></div>}
          {filteredAssets.map((asset) => (
            <button
              className={`source-library-row${asset.sourceId === selected?.sourceId ? ' is-selected' : ''}`}
              type="button"
              key={asset.sourceId}
              aria-pressed={asset.sourceId === selected?.sourceId}
              onClick={() => setSelectedId(asset.sourceId)}
            >
              <span className="source-library-row-main">
                <strong>{asset.title}</strong>
                <small>{asset.sourceId} · {displayFamily(asset.family)}</small>
              </span>
              <AssetStatus disposition={asset.disposition} />
            </button>
          ))}
        </nav>

        {selected ? (
          <article className="source-library-inspector" aria-label={`Selected source ${selected.sourceId}`}>
            <div className="source-library-inspector-head">
              <div>
                <span className="source-library-kicker">{selected.sourceId} · {displayFamily(selected.family)}</span>
                <h2>{selected.title}</h2>
              </div>
              <AssetStatus disposition={selected.disposition} />
            </div>
            <div className="source-library-image-wrap">
              {imageErrorFor === selected.sourceId
                ? <div className="source-library-image-error" role="alert">Original image unavailable for <strong>{selected.sourceId}</strong>.</div>
                : <a href={`/__cambium/image/${encodeURIComponent(selected.sourceId)}`} target="_blank" rel="noopener" aria-label={`Open full-size original for ${selected.sourceId}`}>
                  <img src={`/__cambium/image/${encodeURIComponent(selected.sourceId)}`} alt={`${selected.title} original reference`} onError={() => setImageErrorFor(selected.sourceId)} />
                </a>}
            </div>
            <a className="source-library-original-link" href={`/__cambium/image/${encodeURIComponent(selected.sourceId)}`} target="_blank" rel="noopener">Open full-size original image</a>
            <div className="source-library-copy-grid">
              <section>
                <span className="source-library-kicker">Observed</span>
                <p>{selected.observed}</p>
              </section>
              <section>
                <span className="source-library-kicker">Plexus translation</span>
                <p>{selected.translation}</p>
              </section>
              <section className="source-library-avoid">
                <span className="source-library-kicker">Avoid</span>
                <p>{selected.avoid}</p>
              </section>
            </div>
            <section className="source-library-pages" aria-label="Suggested Plexus pages">
              <span className="source-library-kicker">Suggested pages</span>
              <div>
                {selected.pages.length > 0
                  ? selected.pages.map((page) => <button className="source-library-page-button" type="button" key={page} onClick={() => onNavigate(page)}>{page}</button>)
                  : <span className="source-library-muted">No page mapping recorded.</span>}
              </div>
            </section>
            <details className="source-library-details">
              <summary>Details</summary>
              <dl>
                <div><dt>Source path</dt><dd>{selected.organizedPath}</dd></div>
                <div><dt>Original file</dt><dd>{selected.originalFilename}</dd></div>
                <div><dt>Dimensions</dt><dd>{selected.dimensions.width} × {selected.dimensions.height}</dd></div>
                <div><dt>SHA-256</dt><dd>{selected.sha256}</dd></div>
                <div><dt>Map SHA-256</dt><dd>{manifest.sourceMapSha256}</dd></div>
                <div><dt>Identity confidence</dt><dd>{selected.identityConfidence}</dd></div>
                <div><dt>Inspection</dt><dd>{selected.inspection}</dd></div>
                <div><dt>Semantic owner</dt><dd>{selected.semanticOwner ?? 'Unassigned'}</dd></div>
                <div><dt>Authority</dt><dd>{selected.authority}</dd></div>
                <div><dt>Duplicate lineage</dt><dd>{selected.duplicateOf ?? 'No duplicate relation recorded.'}</dd></div>
              </dl>
              <a href={`/__cambium/image/${encodeURIComponent(selected.sourceId)}`} target="_blank" rel="noopener">Open original image</a>
            </details>
          </article>
        ) : (
          <div className="source-library-no-selection">Select a source asset to inspect its original image.</div>
        )}
      </div>
    </section>
  );
}
