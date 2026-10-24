// Browser fingerprint for the guest gate. `fp` identifies the browser profile (stable across tabs
// and incognito); `hw` identifies the machine-class and is paired with the network on the server.
// Nothing leaves the device except two salted-on-the-server hashes.

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function canvasSignature(): string {
  try {
    const c = document.createElement('canvas'); c.width = 220; c.height = 40;
    const x = c.getContext('2d'); if (!x) return 'no-canvas';
    x.textBaseline = 'top'; x.font = '16px Arial'; x.fillStyle = '#f60'; x.fillRect(10, 4, 80, 24);
    x.fillStyle = '#069'; x.fillText('WikiRush, Duelio ☃ \u{1F30D}', 4, 8);
    return c.toDataURL().slice(-120);
  } catch { return 'canvas-blocked'; }
}

function gpu(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && ext ? `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}` : 'no-gpu';
  } catch { return 'gpu-blocked'; }
}

export async function guestIds(): Promise<{ fp: string; hw: string } | null> {
  try {
    if (!crypto?.subtle) return null;
    const n = navigator as Navigator & { deviceMemory?: number };
    const hw = [n.hardwareConcurrency, n.deviceMemory, screen.width, screen.height, screen.colorDepth, window.devicePixelRatio, gpu(), n.platform].join('|');
    const fp = [hw, n.language, Intl.DateTimeFormat().resolvedOptions().timeZone, n.userAgent, canvasSignature()].join('||');
    return { fp: (await sha256(fp)).slice(0, 48), hw: (await sha256(hw)).slice(0, 48) };
  } catch { return null; }
}
