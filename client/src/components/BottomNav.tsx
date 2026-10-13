import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Bookmark, User as UserIcon, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Hide bottom nav on watch pages to avoid overlaying video controls
  if (location.pathname.startsWith('/watch/')) {
    return null;
  }

  // Simplified navigation: single Search tab (replaces Movies + Series) plus Premium & Profile
  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Search', path: '/search', icon: Search },
    { name: 'Watchlist', path: '/watchlist', icon: Bookmark },
    { name: 'Premium', path: '/premium', icon: Crown },
    { name: user ? 'Profile' : 'Sign in', path: user ? '/profile' : '/profile', icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-dark-base/95 backdrop-blur-xl border-t border-dark-border/80 px-2 py-1.5 shadow-2xl">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-2 sm:px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? item.path === '/premium'
                    ? 'text-yellow-400 font-bold scale-105'
                    : 'text-brand-500 font-bold scale-105'
                  : item.path === '/premium'
                    ? 'text-yellow-500/80 hover:text-yellow-300'
                    : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {isActive && (
                  <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full shadow-sm ${item.path === '/premium' ? 'bg-yellow-400 shadow-yellow-400' : 'bg-brand-500 shadow-brand-500'}`} />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
