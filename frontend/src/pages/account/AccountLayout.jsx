import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, MapPin, Package, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cx } from '../../components/ui';

const LINKS = [
  { to: '/account', label: 'Profile', icon: User, end: true },
  { to: '/account/orders', label: 'My orders', icon: Package },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/account/password', label: 'Password', icon: KeyRound },
];

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/');
  };

  const linkClass = ({ isActive }) =>
    cx(
      'flex min-h-11 shrink-0 items-center gap-3 rounded-full px-4 text-[15px] font-medium transition-colors duration-200 lg:rounded-xl',
      isActive ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-sand-100'
    );

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-8">
        <p className="eyebrow mb-2">My account</p>
        <h1 className="text-3xl font-medium sm:text-4xl">Hello, {user.name.split(' ')[0]}</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-12">
        <nav aria-label="Account" className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </NavLink>
          ))}
          <button type="button" onClick={signOut} className="flex min-h-11 shrink-0 items-center gap-3 rounded-full px-4 text-[15px] font-medium text-clay-600 hover:bg-clay-50 lg:mt-3 lg:rounded-xl lg:border-t lg:border-sand-200 lg:pt-1">
            <LogOut className="size-[18px]" aria-hidden />
            Sign out
          </button>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
