import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Content } from '../types';
import { Play, Star, Plus, Check, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getLocalWatchlist,
  toggleLocalWatchlist,
  getLocalFavorites,
  toggleLocalFavorites,
} from '../utils/localStorage';
import { toggleWatchlistApi, toggleFavoriteApi } from '../services/api';

interface MediaCardProps {
  item: Content;
  aspectRatio?: 'poster' | 'backdrop';
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, aspectRatio = 'poster' }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [inWatchlist, setInWatchlist] = useState<boolean>(() => {
    if (user && user.watchlist) {
      return user.watchlist.includes(item._id);
    }
    return getLocalWatchlist().includes(item._id);
  });

  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    if (user && user.favorites) {
      return user.favorites.includes(item._id);
    }
    return getLocalFavorites().includes(item._id);
  });

  const handleWatchlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (user) {
      try {
        const res = await toggleWatchlistApi(item._id);
        setInWatchlist(res.inWatchlist);
        showToast(
          res.inWatchlist
            ? `Added "${item.title}" to Watchlist`
            : `Removed "${item.title}" from Watchlist`,
          'success'
        );
      } catch (err) {
        showToast('Failed to update watchlist', 'error');
      }
    } else {
      const result = toggleLocalWatchlist(item._id);
      setInWatchlist(result);
      showToast(
        result
          ? `Saved "${item.title}" to Watchlist`
          : `Removed "${item.title}" from Watchlist`,
        'success'
      );
    }
  };

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (user) {
      try {
        const res = await toggleFavoriteApi(item._id);
        setIsFavorite(res.isFavorite);
        showToast(
          res.isFavorite
            ? `Marked "${item.title}" as Favorite`
            : `Removed "${item.title}" from Favorites`,
          'success'
        );
      } catch (err) {
        showToast('Failed to update favorites', 'error');
      }
    } else {
      const result = toggleLocalFavorites(item._id);
      setIsFavorite(result);
      showToast(
        result
          ? `Marked "${item.title}" as Favorite`
          : `Removed "${item.title}" from Favorites`,
        'success'
      );
    }
  };

  const targetPath = item.type === 'movie' ? `/movie/${item.slug}` : `/series/${item.slug}`;

  return (
    <div className="group relative flex-none w-36 sm:w-48 md:w-56 rounded-xl overflow-hidden bg-dark-card border border-dark-border/80 shadow-lg transition-all duration-300 hover:scale-[1.03] hover:border-gray-500 hover:shadow-2xl flex flex-col">
      <Link to={targetPath} className="block relative aspect-[2/3] w-full overflow-hidden bg-dark-surface">
        <img
          src={aspectRatio === 'backdrop' ? item.backdropUrl : item.posterUrl}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Rating Badge */}
        <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center space-x-1 border border-white/10 shadow">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span className="text-[11px] font-bold text-white">{item.rating?.toFixed(1) || '8.0'}</span>
        </div>

        {/* Type Badge */}
        <div className="absolute top-2 right-2 bg-brand-500/90 text-white font-extrabold text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded shadow">
          {item.type}
        </div>

        {/* Quick Action Overlay (Always touch accessible on hover / mobile tap) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <div className="flex items-center space-x-2 mb-2">
            <button
              onClick={() => navigate(targetPath)}
              className="w-9 h-9 bg-brand-500 hover:bg-brand-600 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
              title="Watch Now"
            >
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </button>

            <button
              onClick={handleWatchlistToggle}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors active:scale-95 ${
                inWatchlist
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-black/60 border-white/30 text-white hover:bg-white/20'
              }`}
              title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            >
              {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleFavoriteToggle}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors active:scale-95 ${
                isFavorite
                  ? 'bg-red-500/20 border-red-500 text-red-500 fill-red-500'
                  : 'bg-black/60 border-white/30 text-white hover:bg-white/20'
              }`}
              title={isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          </div>
        </div>
      </Link>

      {/* Card Info Below Poster (Visible always for excellent mobile legibility) */}
      <div className="p-2.5 flex-1 flex flex-col justify-between bg-dark-card border-t border-dark-border/40">
        <div>
          <h3 className="font-bold text-white text-xs sm:text-sm line-clamp-1 leading-snug group-hover:text-brand-500 transition-colors">
            {item.title}
          </h3>
          <div className="flex items-center text-[10px] sm:text-[11px] text-gray-400 space-x-1.5 mt-0.5">
            <span>{item.releaseYear}</span>
            <span>•</span>
            <span className="truncate max-w-[100px]">{item.genres?.slice(0, 2).join(', ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
