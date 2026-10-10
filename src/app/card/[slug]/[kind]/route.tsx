import { cards } from './impl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: { slug: string; kind: string } }) {
  return cards(req, ctx.params);
}
