/**
 * What the phone can afford right now.
 *
 * Roughly 69% of Nigerian internet traffic is mobile, often on a metered plan
 * and a mid-range Android (planning.md §2.6). Loading a 12MB preview nobody
 * asked for spends someone's data on our behalf.
 */

interface NetworkInformation {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  saveData?: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

function connection(): NetworkInformation | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

/** True when the phone has asked us to use less data, or the link is slow. */
export function isFrugal(): boolean {
  const info = connection();
  if (!info) return false;
  if (info.saveData) return true;
  return info.effectiveType === 'slow-2g' || info.effectiveType === '2g' || info.effectiveType === '3g';
}

/**
 * How much of a video to fetch before the customer presses play.
 *
 * `none` on a frugal connection: nothing downloads until they choose to watch.
 * `metadata` otherwise — enough for the duration and first frame, not the file.
 * Never `auto`, on any connection.
 */
export function videoPreload(): 'none' | 'metadata' {
  return isFrugal() ? 'none' : 'metadata';
}

/** Subscribe to connection changes, e.g. wifi to mobile data. */
export function onNetworkChange(listener: () => void): () => void {
  const info = connection();
  info?.addEventListener?.('change', listener);
  return () => info?.removeEventListener?.('change', listener);
}
