import Link from 'next/link';

export default function Logo({ href = '/', compact = false }) {
  return (
    <Link href={href} className="brand" aria-label="Expreso 4 Bahía, inicio">
      <span className="logo">4B</span>
      {!compact && (
        <span className="wordmark">
          <small>Expreso</small>
          <span>4 Bahía</span>
        </span>
      )}
    </Link>
  );
}
