import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Profile, Scheme } from '@/types';
import { recommendations } from '@/lib/matching';
export async function recommendationsPdf(
  profile: Partial<Profile>,
  schemes: Scheme[],
) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 785;
  const clean = (s: string) =>
    s
      .replace(/\u20b9/g, 'INR ')
      .replace(/[—–]/g, '-')
      .replace(/[^\x20-\x7e]/g, '?');
  function line(text: string, heading = false) {
    const words = clean(text).split(/\s+/);
    let row = '';
    const rows: string[] = [];
    for (const w of words) {
      if (font.widthOfTextAtSize(row + ' ' + w, heading ? 12 : 10) > 485) {
        rows.push(row);
        row = w;
      } else row += (row ? ' ' : '') + w;
    }
    rows.push(row);
    for (const r of rows) {
      if (y < 65) {
        page = pdf.addPage([595, 842]);
        y = 785;
      }
      page.drawText(r, {
        x: 50,
        y,
        size: heading ? 12 : 10,
        font: heading ? bold : font,
        color: heading ? rgb(0.12, 0.28, 0.48) : rgb(0.25, 0.31, 0.38),
      });
      y -= heading ? 21 : 16;
    }
    y -= 7;
  }
  line('YOJANASETU | My Scheme Recommendations', true);
  line('Business: ' + (profile.businessName ?? 'Business profile'));
  line('Generated: ' + new Date().toISOString().slice(0, 10));
  line(
    [profile.industry, profile.state, profile.stage]
      .filter(Boolean)
      .join(' | '),
  );
  line(
    'Annual turnover: INR ' +
      (profile.turnover ?? 0).toLocaleString('en-IN') +
      ' | Investment: INR ' +
      (profile.investment ?? 0).toLocaleString('en-IN'),
  );
  line('Objectives: ' + (profile.objectives ?? []).join(', '));
  line(
    'Matches indicate relevance, not approval. Demo data - verify before application.',
  );
  const matches = recommendations(profile, schemes);
  if (!matches.length)
    line('No matches above 50. Complete or update your business profile.');
  for (const m of matches) {
    if (y < 410) {
      page = pdf.addPage([595, 842]);
      y = 785;
    }
    line(m.scheme.name + ' | ' + m.score + '% ' + m.classification, true);
    line(m.scheme.benefit);
    line(
      'Data status: ' +
        (m.scheme.demo ? 'DEMO - not verified' : m.scheme.status),
    );
    line(
      'Eligibility: ' +
        m.conditions.map((c) => c.label + ' [' + c.status + ']').join('; '),
    );
    line('Required documents: ' + m.scheme.documents.join(', '));
    line('Source: ' + m.scheme.source);
    line('Official URL: ' + (m.scheme.officialUrl ?? 'Not available'));
    line('Last verified: ' + (m.scheme.verifiedAt ?? 'Never'));
    line('Deadline: ' + (m.scheme.deadline ?? 'Not recorded'));
  }
  pdf.getPages().forEach((p, i) =>
    p.drawText('YojanaSetu | ' + (i + 1) + ' / ' + pdf.getPageCount(), {
      x: 50,
      y: 30,
      size: 8,
      font,
      color: rgb(0.4, 0.45, 0.5),
    }),
  );
  return pdf.save();
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
