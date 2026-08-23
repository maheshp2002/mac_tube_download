type Waiter = () => void;

let activeDownloads = 0;
const waiters: Waiter[] = [];

export async function acquireDownloadSlot(maximum = 2) {
  if (activeDownloads < maximum) {
    activeDownloads += 1;
    return releaseDownloadSlot;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  activeDownloads += 1;
  return releaseDownloadSlot;
}

function releaseDownloadSlot() {
  activeDownloads = Math.max(0, activeDownloads - 1);
  waiters.shift()?.();
}
