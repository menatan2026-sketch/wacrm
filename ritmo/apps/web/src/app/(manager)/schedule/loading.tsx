import { Skeleton } from '@ritmo/ui';

/** Week board skeleton: head, stat strip, then seven columns of rows. */
export default function Loading() {
  return (
    <div className="content" aria-busy="true">
      <div className="head">
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <Skeleton width={160} height={28} />
          <Skeleton width={260} />
        </div>
      </div>
      <div className="rt-stats" style={{ '--cols': 4 } as React.CSSProperties}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rt-stat">
            <Skeleton width="50%" />
            <Skeleton width="70%" height={28} />
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="sched">
          {Array.from({ length: 8 * 6 }, (_, i) => (
            <div key={i}>
              <Skeleton height={i % 8 === 0 ? 14 : 40} width={i % 8 === 0 ? '70%' : '100%'} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
