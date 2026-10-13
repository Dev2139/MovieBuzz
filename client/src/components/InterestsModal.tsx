import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, Flame, Compass, Zap, Film } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getLocalInterests, saveLocalInterests } from '../utils/localStorage';
import { updateUserPreferencesApi } from '../services/api';

interface InterestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (genres: string[]) => void;
  availableGenres?: string[];
  initialSelected?: string[];
}

const DEFAULT_GENRES = [
  { name: 'Action', emoji: '💥', desc: 'Explosive thrills & stunts' },
  { name: 'Sci-Fi', emoji: '🚀', desc: 'Futuristic & alien worlds' },
  { name: 'Thriller', emoji: '⚡', desc: 'Edge-of-your-seat suspense' },
  { name: 'Comedy', emoji: '😂', desc: 'Laugh-out-loud humor' },
  { name: 'Drama', emoji: '🎭', desc: 'Emotional & deep narratives' },
  { name: 'Horror', emoji: '👻', desc: 'Spine-chilling scares' },
  { name: 'Adventure', emoji: '🧭', desc: 'Epic journeys & quests' },
  { name: 'Crime', emoji: '🕵️', desc: 'Mysteries, heists & mobsters' },
  { name: 'Animation', emoji: '🎨', desc: 'Stunning animated features' },
  { name: 'Fantasy', emoji: '🧙', desc: 'Magic, myths & legends' },
  { name: 'Romance', emoji: '❤️', desc: 'Love stories & passion' },
  { name: 'Mystery', emoji: '🔍', desc: 'Puzzles & unexpected twists' },
  { name: 'Documentary', emoji: '📽️', desc: 'Real life stories & facts' },
];

const PRESETS = [
  { name: 'Adrenaline Rush', genres: ['Action', 'Thriller', 'Crime'] },
  { name: 'Sci-Fi Explorer', genres: ['Sci-Fi', 'Fantasy', 'Adventure'] },
  { name: 'Feel-Good Binge', genres: ['Comedy', 'Animation', 'Romance'] },
  { name: 'Mind-Benders', genres: ['Thriller', 'Mystery', 'Sci-Fi'] },
];

export const InterestsModal: React.FC<InterestsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  availableGenres,
  initialSelected,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialSelected && initialSelected.length > 0) {
        setSelectedGenres(initialSelected);
      } else if (user?.preferredGenres && user.preferredGenres.length > 0) {
        setSelectedGenres(user.preferredGenres);
      } else {
        setSelectedGenres(getLocalInterests());
      }
    }
  }, [isOpen, initialSelected, user]);

  if (!isOpen) return null;

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const applyPreset = (genres: string[]) => {
    setSelectedGenres(Array.from(new Set([...selectedGenres, ...genres])));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      saveLocalInterests(selectedGenres);

      if (user) {
        await updateUserPreferencesApi(selectedGenres);
      }

      showToast('Taste preferences updated! Tailoring your feed...', 'success');
      onSaved?.(selectedGenres);
      onClose();
    } catch (error) {
      showToast('Failed to save preferences to cloud, saved locally', 'info');
      onSaved?.(selectedGenres);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const genreList = availableGenres && availableGenres.length > 0
    ? availableGenres.map((g) => {
        const match = DEFAULT_GENRES.find((d) => d.name.toLowerCase() === g.toLowerCase());
        return match || { name: g, emoji: '🎬', desc: 'Featured Cinema' };
      })
    : DEFAULT_GENRES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-dark-card border border-dark-border/90 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Glow Header Accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-500 via-amber-400 to-brand-500" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-dark-border/80 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center flex-none">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-extrabold text-white flex items-center space-x-2">
                <span>Personalize Your Recommendations</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Select your favorite genres to tune your AI recommendation engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg bg-dark-surface hover:bg-dark-border transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Quick Presets */}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Quick Taste Presets</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.genres)}
                  className="px-3 py-1.5 bg-dark-surface hover:bg-brand-500/20 text-gray-300 hover:text-brand-300 border border-dark-border hover:border-brand-500/50 rounded-xl text-xs font-medium transition-all active:scale-95 flex items-center space-x-1.5"
                >
                  <Flame className="w-3 h-3 text-brand-400" />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Genres Grid */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
              <span className="flex items-center space-x-1.5">
                <Compass className="w-3.5 h-3.5 text-brand-400" />
                <span>Select Genres ({selectedGenres.length} picked)</span>
              </span>
              {selectedGenres.length > 0 && (
                <button
                  onClick={() => setSelectedGenres([])}
                  className="text-[11px] text-gray-400 hover:text-white underline cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {genreList.map((g) => {
                const isSelected = selectedGenres.includes(g.name);
                return (
                  <div
                    key={g.name}
                    onClick={() => toggleGenre(g.name)}
                    className={`relative p-3 rounded-xl cursor-pointer border transition-all duration-200 select-none ${
                      isSelected
                        ? 'bg-gradient-to-br from-brand-500/25 to-brand-700/10 border-brand-500 text-white shadow-md shadow-brand-500/10'
                        : 'bg-dark-surface border-dark-border/80 hover:border-gray-500 text-gray-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{g.emoji}</span>
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-all ${
                          isSelected ? 'bg-brand-500 text-white scale-110' : 'border border-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm mt-2">{g.name}</h4>
                    <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{g.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-dark-border/80 bg-dark-surface/50 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {selectedGenres.length === 0
              ? 'Select at least 1 genre for best results'
              : `${selectedGenres.length} genre${selectedGenres.length > 1 ? 's' : ''} chosen`}
          </p>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-gray-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Tuning Feed...' : 'Apply & Save'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
