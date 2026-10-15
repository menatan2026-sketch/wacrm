import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ActivityBar, Meter, buttonClass, type Segment } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { requireCtx } from '@/server/context';
import { collectedData } from '@/server/me-queries';
import { fmtDuration, iso } from '@/lib/format';
import { CorrectionForm } from './CorrectionForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('collected'))('title') };
}

export default async function CollectedPage() {
  const ctx = await requireCtx();
  const t = await getTranslations('collected');
  const ta = await getTranslations('activity');
  const tm = await getTranslations('me');
  const d = await collectedData(ctx);
  const top = d.apps[0]?.minutes ?? 1;
  const segments: Segment[] = d.segments.map((s) => ({
    kind: s.kind,
    weight: Math.max(1, Math.round((s.ended_at.getTime() - s.started_at.getTime()) / 60000)),
  }));

  return (
    <article className="doc m-enter">
      <header className="doc__head">
        <span className="doc__eyebrow">
          <Icon name="shield" size={14} />
          {t('eyebrow')}
        </span>
        <h1 className="t-h1">{t('title')}</h1>
        <p>{t('intro')}</p>
      </header>

      <section className="doc__sec">
        <div className="ledger">
          <div className="yes">
            <h3>
              <Icon name="check" size={15} />
              {t('collected')}
            </h3>
            <ul>
              {(['c1', 'c2', 'c3', 'c4'] as const).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          </div>
          <div className="no">
            <h3>
              <Icon name="eyeOff" size={15} />
              {t('neverCollected')}
            </h3>
            <ul>
              {(['n1', 'n2', 'n3', 'n4', 'n5'] as const).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="doc__sec">
        <h2>
          {t('yourApps')}
          {d.segments.length > 0 && (
            <span className="rt-pill rt-pill--live" style={{ marginInlineStart: 'auto' }}>
              {t('live')}
            </span>
          )}
        </h2>
        {d.segments.length === 0 ? (
          <p className="muted">{t('noApps')}</p>
        ) : (
          <div className="apps">
            <ActivityBar segments={segments} label={ta('totals', { active: iso(fmtDuration(d.active)), idle: iso(fmtDuration(d.idle)) })} />
            <p className="t-caption muted">{ta('totals', { active: iso(fmtDuration(d.active)), idle: iso(fmtDuration(d.idle)) })}</p>
            {d.apps.map((a) => (
              <div key={a.app} className="app">
                <span dir="auto">{a.app}</span>
                <Meter value={(a.minutes / top) * 100} label={`${a.app} ${fmtDuration(a.minutes)}`} />
                <span className="t rt-num">{fmtDuration(a.minutes)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="doc__sec">
        <h2>{t('yourTime')}</h2>
        <div className="mweek">
          <div>
            <span>{tm('hours')}</span>
            <b className="t-figure rt-num">{fmtDuration(d.week.total)}</b>
          </div>
          <div>
            <span>125% / 150%</span>
            <b className="t-figure rt-num">{`${fmtDuration(d.week.overtime1)} / ${fmtDuration(d.week.overtime2)}`}</b>
          </div>
        </div>
      </section>

      <section className="doc__sec retain">
        <Icon name="clock" />
        <p>
          <b>{t('retention')}</b>
          {t('retentionBody')}
        </p>
      </section>

      <section className="doc__sec">
        <div className="doc__actions">
          <a href="/api/me/export" className={buttonClass('primary')} download>
            <Icon name="download" />
            {t('download')}
          </a>
          <CorrectionForm />
        </div>
        <p className="t-caption muted" style={{ marginBlockStart: 'var(--space-2)' }}>
          {t('downloadHint')}
        </p>
      </section>
    </article>
  );
}
