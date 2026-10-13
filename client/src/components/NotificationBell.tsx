import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import {
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotificationsApi,
    enabled: !!user,
    refetchInterval: 30 * 1000, // poll every 30s while logged in
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const markReadMutation = useMutation({
    mutationFn: markNotificationReadApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsReadApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-gray-300 hover:text-white bg-dark-surface/80 rounded-xl border border-dark-border/60 transition"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-brand-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-brand-500/40">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-dark-card border border-dark-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
            <span className="text-white font-bold text-sm">
              Notifications {unreadCount > 0 && <span className="text-brand-400">({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-300 font-semibold transition"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-gray-500 text-sm">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div
                    className={`flex gap-3 px-4 py-3 border-b border-dark-border/50 hover:bg-dark-hover transition ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <div
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        n.type === 'request'
                          ? 'bg-brand-500/20 text-brand-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}
                    >
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold leading-snug">{n.title}</p>
                      {n.body && (
                        <p className="text-gray-400 text-[11px] mt-0.5 leading-snug">{n.body}</p>
                      )}
                      <p className="text-gray-500 text-[10px] mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          markReadMutation.mutate(n._id);
                        }}
                        className="shrink-0 text-gray-500 hover:text-brand-400 transition"
                        aria-label="Mark read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );

                return n.link ? (
                  <Link key={n._id} to={n.link} onClick={() => { setOpen(false); if (!n.read) markReadMutation.mutate(n._id); }}>
                    {content}
                  </Link>
                ) : (
                  <div key={n._id} onClick={() => { setOpen(false); if (!n.read) markReadMutation.mutate(n._id); }}>
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
