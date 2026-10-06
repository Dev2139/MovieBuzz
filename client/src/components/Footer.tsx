import React from 'react';
import { Link } from 'react-router-dom';
import { Film, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-dark-surface border-t border-dark-border text-gray-400 text-sm mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-2">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white">
                <Film className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white tracking-wider">
                CINE<span className="text-brand-500">STREAM</span>
              </span>
            </Link>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              CineStream is an authorized streaming platform serving legally licensed movie and TV series content. Enjoy high-definition playback with instant streaming and direct downloads.
            </p>
            <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg w-fit">
              <ShieldCheck className="w-4 h-4" />
              <span>Authorized License Operator Distribution</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/" className="hover:text-white transition-colors">Home Catalog</Link></li>
              <li><Link to="/movies" className="hover:text-white transition-colors">Browse Movies</Link></li>
              <li><Link to="/series" className="hover:text-white transition-colors">TV Series & Seasons</Link></li>
              <li><Link to="/watchlist" className="hover:text-white transition-colors">My Watchlist</Link></li>
              <li><Link to="/history" className="hover:text-white transition-colors">Continue Watching</Link></li>
            </ul>
          </div>

          {/* Platform Info */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Platform & Legal</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="text-gray-400">Terms of Service</span></li>
              <li><span className="text-gray-400">Privacy Policy</span></li>
              <li><span className="text-gray-400">Content Rights & DMCA</span></li>
              <li><span className="text-gray-400">No Login Required Access</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-dark-border flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500">
          <p>© 2026 CineStream. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">Powered by MERN & Backend Storage Integration</p>
        </div>
      </div>
    </footer>
  );
};
