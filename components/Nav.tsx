'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: '홈' },
  { href: '/vocab', label: '단어장' },
  { href: '/stats', label: '통계' },
  { href: '/setup', label: '설치' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex justify-center border-b border-gray-200 dark:border-gray-800">
      <ul className="flex w-full max-w-xl gap-1 px-4">
        {links.map((link) => {
          const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`flex h-12 items-center border-b-2 px-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
