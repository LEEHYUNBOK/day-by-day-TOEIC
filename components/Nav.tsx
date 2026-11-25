'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: '홈' },
  { href: '/bank', label: '질문' },
  { href: '/graph', label: '그래프' },
  { href: '/tree', label: '트리' },
];

// 풀이 화면은 시험지처럼 전체화면이라 내비게이션을 숨긴다.
export default function Nav() {
  const pathname = usePathname();
  if (pathname.startsWith('/study')) return null;
  return (
    <nav className="flex gap-4 border-b border-[#1c1a17]/20 px-4 py-3 text-sm font-semibold">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? 'text-blue-600' : 'text-zinc-600'}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
