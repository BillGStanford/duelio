export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path d="M14 2a12 12 0 0 0 0 24z" fill="#2433E0" />
      <path d="M14 2a12 12 0 0 1 0 24z" fill="#C81E4B" />
    </svg>
  );
}
