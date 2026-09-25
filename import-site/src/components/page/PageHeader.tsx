import { RevealText } from "@/components/ui/RevealText";
import s from "./PageHeader.module.css";

/** Standard header for interior pages: index label, big title, lede. */
export function PageHeader({ index, title, lede, children }: { index: string; title: string[]; lede?: string; children?: React.ReactNode }) {
  return (
    <header className={`container ${s.head}`}>
      <p className={s.index}>{index}</p>
      <RevealText as="h1" className="display-l" lines={title} threshold={0} />
      {lede && <p className={`body-l ${s.lede}`}>{lede}</p>}
      {children}
    </header>
  );
}
