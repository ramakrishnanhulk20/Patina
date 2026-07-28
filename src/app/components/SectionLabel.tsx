export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="t-label flex items-center gap-2.5 text-text-3">
      <span className="rings" aria-hidden="true" />
      {children}
    </p>
  );
}
