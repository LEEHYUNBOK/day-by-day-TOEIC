'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: '홈' },
  { href: '/calendar', label: '달력' },
  { href: '/review', label: '복습' },
  { href: '/notes', label: '오답노트' },
  { href: '/stats', label: '통계' },
];

export default function Nav() {
  const pathname = usePathname();

  if (pathname.startsWith('/learn')) {
    return null;
  }

  return (
    <nav>
      <ul className="flex gap-4 p-4">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
