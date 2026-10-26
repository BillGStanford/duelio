/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

export default function ModeCard({ href, img, tag, title, text, cta = 'Play', wide }: { wide?: boolean; href: string; img: string; tag: string; title: string; text: string; cta?: string }) {
  return <Link href={href} className={`gx-mode group ${wide ? 'gx-mode-wide' : ''}`}>
    <img src={img} alt="" loading="lazy" width={960} height={600} />
    <span className="gx-mode-tag">{tag}</span>
    <div className="gx-mode-body">
      <h3 className="text-xl font-bold leading-tight">{title}</h3>
      <p className="mt-1 text-sm leading-snug text-white/70">{text}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#aeb7ff] transition group-hover:gap-2 group-hover:text-white">{cta} <span aria-hidden="true">→</span></span>
    </div>
  </Link>;
}
