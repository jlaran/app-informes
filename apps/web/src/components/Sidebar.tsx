'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/remates/propiedades', label: 'Remates de Propiedades', icon: '🏘️' },
  { href: '/remates/vehiculos', label: 'Remates de Vehículos', icon: '🚗' },
  { href: '/fallecidos', label: 'Personas Fallecidas', icon: '🕊️' },
  { href: '/sociedades', label: 'Sociedades Disueltas', icon: '🏢' },
  { href: '/alertas', label: 'Alertas', icon: '🔔' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col border-b border-slate-200 bg-white md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="border-b border-slate-200 px-6 py-5">
        <Link href="/" className="block">
          <span className="text-lg font-bold text-brand-700">Informes CR</span>
          <p className="text-xs text-slate-500">Boletines Judiciales</p>
        </Link>
      </div>
      <nav className="flex flex-row gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              <span aria-hidden>{item.icon}</span>
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
