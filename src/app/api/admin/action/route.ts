import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, isAdminCookie } from '@/lib/auth';
import { redirectTo, sameOrigin } from '@/lib/http';
import { getStore } from '@/lib/store';
import type { ContentStatus, DilemmaPatch } from '@/lib/types';
import { cleanLine, cleanText, containsPersonalInfo, slugify } from '@/lib/validate';

export const dynamic = 'force-dynamic';

const str = (f: FormData, k: string) => (typeof f.get(k) === 'string' ? (f.get(k) as string) : '');

function parseClose(v: string): string | null | undefined {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function uniqueSlug(base: string): Promise<string> {
  const store = getStore();
  let slug = base;
  for (let i = 2; await store.slugExists(slug); i++) slug = `${base.slice(0, 70)}-${i}`;
  return slug;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse('Cross-site request blocked.', { status: 403 });
  if (!isAdminCookie(cookies().get(ADMIN_COOKIE)?.value)) return new NextResponse('Unauthorized', { status: 401 });

  const form = await req.formData();
  const action = str(form, 'action');
  const store = getStore();
  const done = (msg: string) => redirectTo(req, `/admin?msg=${encodeURIComponent(msg)}`);

  try {
    switch (action) {
      case 'create': {
        const question = cleanLine(str(form, 'question'));
        const sideALabel = cleanLine(str(form, 'sideALabel')).slice(0, 24);
        const sideBLabel = cleanLine(str(form, 'sideBLabel')).slice(0, 24);
        if (question.length < 10 || !sideALabel || !sideBLabel) return done('Question and both short labels are required.');
        const slug = await uniqueSlug(slugify(cleanLine(str(form, 'slug')) || question));
        const close = parseClose(str(form, 'closesAt'));
        if (close === undefined) return done('Closing date is not valid.');
        const status: ContentStatus = str(form, 'publish') === 'on' ? 'published' : 'pending';
        await store.createDilemma({
          slug,
          question,
          context: cleanText(str(form, 'context')).slice(0, 280),
          sideALabel,
          sideADescription: cleanLine(str(form, 'sideADescription')).slice(0, 160),
          sideBLabel,
          sideBDescription: cleanLine(str(form, 'sideBDescription')).slice(0, 160),
          status,
          editorial: true,
          submittedBy: null,
          closesAt: close,
        });
        return done(`Created /d/${slug} (${status}).`);
      }
      case 'update': {
        const id = str(form, 'id');
        const close = parseClose(str(form, 'closesAt'));
        if (close === undefined) return done('Closing date is not valid.');
        const patch: DilemmaPatch = {
          question: cleanLine(str(form, 'question')),
          context: cleanText(str(form, 'context')).slice(0, 280),
          sideALabel: cleanLine(str(form, 'sideALabel')).slice(0, 24),
          sideADescription: cleanLine(str(form, 'sideADescription')).slice(0, 160),
          sideBLabel: cleanLine(str(form, 'sideBLabel')).slice(0, 24),
          sideBDescription: cleanLine(str(form, 'sideBDescription')).slice(0, 160),
          closesAt: close,
        };
        if (!patch.question || !patch.sideALabel || !patch.sideBLabel) return done('Question and labels cannot be empty.');
        await store.updateDilemma(id, patch);
        return done('Dilemma updated.');
      }
      case 'publish':
        await store.updateDilemma(str(form, 'id'), { status: 'published' });
        return done('Published.');
      case 'unpublish':
        await store.updateDilemma(str(form, 'id'), { status: 'pending' });
        return done('Moved back to pending.');
      case 'remove':
        await store.updateDilemma(str(form, 'id'), { status: 'removed' });
        return done('Removed.');
      case 'approve_submission': {
        const s = await store.getSubmission(str(form, 'id'));
        if (!s || s.status !== 'pending') return done('That submission is no longer pending.');
        const labelA = cleanLine(str(form, 'labelA')).slice(0, 24) || 'Yes';
        const labelB = cleanLine(str(form, 'labelB')).slice(0, 24) || 'No';
        const slug = await uniqueSlug(slugify(s.question));
        await store.createDilemma({
          slug,
          question: s.question,
          context: s.context,
          sideALabel: labelA,
          sideADescription: s.sideA,
          sideBLabel: labelB,
          sideBDescription: s.sideB,
          status: 'published',
          editorial: false,
          submittedBy: s.submitterName && !containsPersonalInfo(s.submitterName) ? s.submitterName : null,
          closesAt: null,
        });
        await store.updateSubmissionStatus(s.id, 'published');
        return done(`Approved and published as /d/${slug}.`);
      }
      case 'reject_submission':
        await store.updateSubmissionStatus(str(form, 'id'), 'rejected');
        return done('Submission rejected.');
      case 'resolve_report':
        await store.resolveReport(str(form, 'id'));
        return done('Report resolved.');
      default:
        return done('Unknown action.');
    }
  } catch {
    return done('That didn\u2019t work. Check the server logs.');
  }
}
