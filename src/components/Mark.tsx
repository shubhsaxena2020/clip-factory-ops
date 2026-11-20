/** Brand mark: three clip frames on a belt. Original, not derived from any product logo. */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="31" height="31" rx="4" fill="#15120f" stroke="#3d342c" />
      <rect x="5" y="8" width="6" height="14" fill="var(--color-sodium)" />
      <rect x="13" y="8" width="6" height="14" fill="var(--color-sodium)" opacity=".6" />
      <rect x="21" y="8" width="6" height="14" fill="var(--color-sodium)" opacity=".3" />
      <path d="M4 26h24" stroke="var(--color-ink)" strokeWidth="2" strokeDasharray="3 2" />
    </svg>
  );
}
