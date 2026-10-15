/* Logos are used as shipped in the brand kit; the on-dark variant swaps in by theme. */
export function Logo({ locale, height = 24 }: { locale: string; height?: number }) {
  const base = locale === 'he' ? 'ritmo-lockup-he' : 'ritmo-lockup';
  const alt = locale === 'he' ? 'ריטמו' : 'Ritmo';
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-light" src={`/brand/${base}.svg`} alt={alt} style={{ blockSize: height }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-dark" src={`/brand/${base}-on-dark.svg`} alt={alt} style={{ blockSize: height }} />
    </>
  );
}

export function Mark({ size = 18 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/ritmo-mark.svg" alt="" style={{ inlineSize: size, blockSize: size }} />;
}
