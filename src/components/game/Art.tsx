/* eslint-disable @next/next/no-img-element */
import { avatarSrc } from '@/lib/account';
import { LEVELS } from '@/lib/wikirush/levels';

/** Round player avatar (12 designs). */
export function Avatar({ n = 1, size = 40, className = '' }: { n?: number; size?: number; className?: string }) {
  return <img src={avatarSrc(n)} alt="" width={size} height={size} className={`shrink-0 rounded-full ${className}`} style={{ width: size, height: size }} />;
}

/** Shield emblem for a level index (0 to 6). */
export function Emblem({ index, size = 40, className = '' }: { index: number; size?: number; className?: string }) {
  const i = Math.min(LEVELS.length - 1, Math.max(0, index));
  return <img src={`/game/level-${i + 1}.png`} alt="" width={size} height={size} className={`shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

/** Pip, the Duelio mascot. */
export function Pip({ size = 120, className = '', float = false }: { size?: number; className?: string; float?: boolean }) {
  return <img src="/game/pip.png" alt="" width={size} height={size} className={`${float ? 'gx-float' : ''} ${className}`} style={{ width: size, height: size }} />;
}
