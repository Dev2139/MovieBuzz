import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, Search, Bookmark, History, Shield, LogOut, User as UserIcon, Menu, X, Sparkles } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Movies', path: '/movies' },
    { name: 'Series', path: '/series' },
    { name: 'Genres', path: '/search?genre=all' },
    { name: 'Watchlist', path: '/watchlist' },
    { name: 'History', path: '/history' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-dark-base/95 backdrop-blur-md border-b border-dark-border py-2.5 shadow-xl'
          : 'bg-gradient-to-b from-black/85 via-black/40 to-transparent py-3.5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform">
            <Film className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-lg sm:text-xl font-extrabold text-white tracking-wider">
            CINE<span className="text-brand-500">STREAM</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`transition-colors ${
                  isActive
                    ? 'text-white font-semibold text-brand-500 border-b-2 border-brand-500 pb-1'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="flex items-center space-x-1.5 text-amber-400 hover:text-amber-300 font-semibold bg-amber-400/10 px-3 py-1 rounded-lg border border-amber-400/20"
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        {/* Right Search & Profile Area (Desktop) */}
        <div className="hidden md:flex items-center space-x-4">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search movies, series..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-dark-surface/90 border border-dark-border rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-brand-500 w-48 focus:w-64 transition-all duration-300"
            />
            <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-gray-400" />
          </form>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 bg-dark-card border border-dark-border hover:border-gray-500 px-3 py-1.5 rounded-full text-sm text-white transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500 flex items-center justify-center text-brand-500 text-xs font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[100px] truncate">{user.name}</span>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-dark-card border border-dark-border rounded-xl shadow-2xl py-2 z-50 text-sm text-gray-200 animate-fade-in">
                  <div className="px-4 py-2 border-b border-dark-border">
                    <p className="font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>

                  <Link
                    to="/watchlist"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 hover:bg-dark-hover transition-colors"
                  >
                    <Bookmark className="w-4 h-4 text-brand-500" />
                    <span>Watchlist</span>
                  </Link>

                  <Link
                    to="/history"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 hover:bg-dark-hover transition-colors"
                  >
                    <History className="w-4 h-4 text-brand-500" />
                    <span>Watch History</span>
                  </Link>

                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center space-x-2 px-4 py-2 hover:bg-dark-hover text-amber-400 font-medium transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Admin Dashboard</span>
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-4 py-2 hover:bg-red-500/10 text-red-400 transition-colors border-t border-dark-border mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-full shadow-lg shadow-brand-500/25 transition-all active:scale-95"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* Mobile Header Icons */}
        <div className="md:hidden flex items-center space-x-2">
          <button
            onClick={() => navigate('/search')}
            className="p-2 text-gray-300 hover:text-white bg-dark-surface/80 rounded-xl border border-dark-border/60"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {user ? (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex items-center space-x-1.5 bg-dark-card border border-dark-border px-2.5 py-1 rounded-xl"
            >
              <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-500 text-[10px] font-bold flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <Menu className="w-4 h-4 text-gray-300" />
            </button>
          ) : (
            <button
              onClick={openAuthModal}
              className="px-3 py-1 bg-brand-500 text-white text-xs font-bold rounded-xl shadow"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Drawer Slide-Down */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[57px] bg-dark-card/95 backdrop-blur-2xl border-b border-dark-border px-4 py-5 space-y-4 shadow-2xl animate-fade-in z-50">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search catalog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-surface border border-dark-border rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          </form>

          {user && (
            <div className="bg-dark-surface p-3 rounded-xl border border-dark-border flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              {user.role === 'admin' && (
                <span className="text-[10px] bg-amber-400/20 border border-amber-400/30 text-amber-400 font-bold px-2 py-0.5 rounded">
                  Admin
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3.5 py-2.5 bg-dark-surface rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-dark-hover border border-dark-border/50 transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {user?.role === 'admin' && (
            <Link
              to="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center space-x-2 w-full py-2.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 font-semibold rounded-xl text-xs"
            >
              <Shield className="w-4 h-4" />
              <span>Admin Management Dashboard</span>
            </Link>
          )}

          {user ? (
            <button
              onClick={() => {
                logout();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Account</span>
            </button>
          ) : (
            <button
              onClick={() => {
                openAuthModal();
                setIsMobileMenuOpen(false);
              }}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-brand-500/20"
            >
              Sign In / Register Account
            </button>
          )}
        </div>
      )}
    </header>
  );
};
