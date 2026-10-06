import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Content } from '../types';
import { Play, Star, Plus, Check, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getLocalWatchlist, toggleLocalWatchlist, getLocalFavorites, toggleLocalFavorites } from '../utils/localStorage';
import { toggleWatchlistApi, toggleFavoriteApi } from '../services/api';

interface MediaCardProps {
  item: Content;
  aspectRatio?: 'poster' | 'backdrop';
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, aspectRatio = 'poster' }) => {
  const { user } = useAuth();
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
      } catch (err) {
        console.error('Failed to update watchlist', err);
      }
    } else {
      const result = toggleLocalWatchlist(item._id);
      setInWatchlist(result);
    }
  };

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (user) {
      try {
        const res = await toggleFavoriteApi(item._id);
        setIsFavorite(res.isFavorite);
      } catch (err) {
        console.error('Failed to update favorites', err);
      }
    } else {
      const result = toggleLocalFavorites(item._id);
      setIsFavorite(result);
    }
  };

  const targetPath = item.type === 'movie' ? `/movie/${item.slug}` : `/series/${item.slug}`;

  return (
    <div className="group relative flex-none w-44 sm:w-52 md:w-60 rounded-xl overflow-hidden bg-dark-card border border-dark-border shadow-lg transition-all duration-300 hover:scale-[1.03] hover:border-gray-500 hover:shadow-2xl">
      <Link to={targetPath} className="block relative aspect-[2/3] w-full overflow-hidden bg-dark-surface">
        <img
          src={aspectRatio === 'backdrop' ? item.backdropUrl : item.posterUrl}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Rating Badge */}
        <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2 py-1 rounded-md flex items-center space-x-1 border border-white/10">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span className="text-[11px] font-bold text-white">{item.rating?.toFixed(1) || '8.0'}</span>
        </div>

        {/* Type Badge */}
        <div className="absolute top-2.5 right-2.5 bg-brand-500/90 text-white font-extrabold text-[10px] tracking-widest uppercase px-2 py-0.5 rounded shadow">
          {item.type}
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <div className="flex items-center space-x-2 mb-2">
            <button
              onClick={() => navigate(targetPath)}
              className="w-10 h-10 bg-brand-500 hover:bg-brand-600 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110"
              title="Watch Now"
            >
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </button>

            <button
              onClick={handleWatchlistToggle}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
                inWatchlist
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-black/60 border-white/30 text-white hover:bg-white/20'
              }`}
              title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            >
              {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>

            <button
              onClick={handleFavoriteToggle}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
                isFavorite
                  ? 'bg-red-500/20 border-red-500 text-red-500 fill-red-500'
                  : 'bg-black/60 border-white/30 text-white hover:bg-white/20'
              }`}
              title={isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          </div>

          <h3 className="font-bold text-white text-sm line-clamp-1 leading-snug">{item.title}</h3>
          <div className="flex items-center text-[11px] text-gray-300 space-x-2 mt-1">
            <span>{item.releaseYear}</span>
            <span>•</span>
            <span className="truncate max-w-[120px]">{item.genres?.slice(0, 2).join(', ')}</span>
          </div>
        </div>
      </Link>
    </div>
  );
};
