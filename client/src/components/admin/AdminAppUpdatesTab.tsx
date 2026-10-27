import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminAppUpdatesApi,
  createAdminAppUpdateApi,
  deleteAdminAppUpdateApi,
  broadcastAdminNotificationApi,
  AppUpdateItem,
} from '../../services/api';
import {
  Smartphone,
  Send,
  Sparkles,
  CheckCircle2,
  Trash2,
  Download,
  AlertTriangle,
  Bell,
  RefreshCw,
  Users,
  ShieldCheck,
} from 'lucide-react';

export const AdminAppUpdatesTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [version, setVersion] = useState('2.9.0');
  const [versionCode, setVersionCode] = useState('29');
  const [title, setTitle] = useState('MovieBuzz v2.9.0 — Cloudflare Edge Streaming & Website Update Hub');
  const [changelog, setChangelog] = useState(
    '• Cloudflare Edge High-Speed Streaming: 100% free unmetered edge bandwidth for instantaneous video playback\n• Direct Website APK Download: Seamless one-tap redirect to website download hub for easy updates\n• Dedicated In-App Update Screen: Full-screen clean update dashboard with changelog details (zero popups)\n• High-Performance MP4 Downloads: Lightning-fast multi-threaded video downloads powered by Cloudflare CDN\n• Offline Downloads Hub: Watch downloaded movies & web series with zero internet connection'
  );
  const [downloadUrl, setDownloadUrl] = useState('/moviebuzz.apk');
  const [apkSize, setApkSize] = useState('54 MB');
  const [isMandatory, setIsMandatory] = useState(false);
  const [broadcastNotification, setBroadcastNotification] = useState(true);

  // Query update history & total user reach
  const { data, isLoading } = useQuery({
    queryKey: ['admin-app-updates'],
    queryFn: fetchAdminAppUpdatesApi,
  });

  const updates = data?.updates || [];
  const totalUsers = data?.totalUsers || 0;
  const activeUpdate = updates.find((u) => u.isActive) || updates[0];

  // Create & broadcast mutation
  const createMutation = useMutation({
    mutationFn: createAdminAppUpdateApi,
    onSuccess: (res) => {
      alert(`🎉 ${res.message}`);
      queryClient.invalidateQueries({ queryKey: ['admin-app-updates'] });
      queryClient.invalidateQueries({ queryKey: ['latest-app-update'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to publish app update');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteAdminAppUpdateApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-app-updates'] });
      queryClient.invalidateQueries({ queryKey: ['latest-app-update'] });
    },
  });

  // Standalone Custom Notification Broadcast
  const [quickTitle, setQuickTitle] = useState('🔥 New App Update v2.9.0 is Ready to Install!');
  const [quickBody, setQuickBody] = useState('Experience zero-lag Cloudflare streaming, offline mode, and high-speed downloads. Tap here to install from our website!');
  const [quickLink, setQuickLink] = useState('/download');

  const broadcastMutation = useMutation({
    mutationFn: broadcastAdminNotificationApi,
    onSuccess: (res) => {
      alert(`🔔 ${res.message}`);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to broadcast notification');
    },
  });

  const handleBroadcastOnly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) {
      alert('Notification title is required.');
      return;
    }
    if (!confirm(`Send notification "${quickTitle}" to all ${totalUsers} user(s)?`)) return;
    broadcastMutation.mutate({
      title: quickTitle.trim(),
      body: quickBody.trim(),
      link: quickLink.trim() || '/download',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!version.trim() || !title.trim() || !changelog.trim()) {
      alert('Please fill out version, title, and changelog.');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to broadcast MovieBuzz v${version} to ${totalUsers} user(s)?`
      )
    ) {
      return;
    }

    createMutation.mutate({
      version: version.trim(),
      versionCode: Number(versionCode) || 1,
      title: title.trim(),
      changelog: changelog.trim(),
      downloadUrl: downloadUrl.trim() || '/moviebuzz.apk',
      apkSize: apkSize.trim() || '55 MB',
      isMandatory,
      broadcastNotification,
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner & Live Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-gradient-to-br from-dark-card to-dark-surface border border-dark-border rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-brand-500/20 text-brand-400 rounded-xl border border-brand-500/30">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Live App Version</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-black text-white">v{activeUpdate?.version || '2.2.0'}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-dark-card to-dark-surface border border-dark-border rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Broadcast Reach</p>
            <p className="text-xl font-black text-white mt-0.5">{totalUsers} Users</p>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-dark-card to-dark-surface border border-dark-border rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Updates Published</p>
            <p className="text-xl font-black text-white mt-0.5">{updates.length} Releases</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Publish Update Form */}
        <div className="lg:col-span-7 bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-dark-border/80 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-400" />
                Publish & Broadcast New App Update
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Release an updated APK version and notify every user across MovieBuzz.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Version String *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2.2.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Version Code (Integer)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 22"
                  value={versionCode}
                  onChange={(e) => setVersionCode(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                Update Headline / Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. MovieBuzz v2.2.0 — Cinema Engine & 120fps Update"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                What's New / Release Notes *
              </label>
              <textarea
                rows={4}
                required
                placeholder="Enter changelog bullet points..."
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-500 leading-relaxed font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">Use bullet points (•) for clean formatting in the user's notification.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  APK Download Endpoint
                </label>
                <input
                  type="text"
                  value={downloadUrl}
                  onChange={(e) => setDownloadUrl(e.target.value)}
                  placeholder="/moviebuzz.apk"
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  APK File Size
                </label>
                <input
                  type="text"
                  value={apkSize}
                  onChange={(e) => setApkSize(e.target.value)}
                  placeholder="55 MB"
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="bg-dark-surface/70 border border-dark-border rounded-xl p-4 space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastNotification}
                  onChange={(e) => setBroadcastNotification(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 bg-dark-card border-dark-border"
                />
                <div>
                  <span className="text-xs font-bold text-white">Broadcast In-App Notification</span>
                  <p className="text-[11px] text-gray-400">
                    Immediately send an in-app alert to all {totalUsers} registered users directing them to install.
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMandatory}
                  onChange={(e) => setIsMandatory(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 bg-dark-card border-dark-border"
                />
                <div>
                  <span className="text-xs font-bold text-amber-300">Mandatory / Critical Update</span>
                  <p className="text-[11px] text-gray-400">
                    Prompts users with high priority to update immediately.
                  </p>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full flex items-center justify-center space-x-2 py-3.5 bg-gradient-to-r from-brand-500 via-red-600 to-amber-600 hover:from-brand-600 hover:to-red-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-brand-500/30 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Broadcasting Update to Users...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>🚀 Publish & Broadcast v{version} to All Users</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Notification & Download Preview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-400" />
              Live User In-App Notification Preview
            </h3>
            <p className="text-xs text-gray-400">
              This is how the broadcast notification will appear in the user's notification feed:
            </p>

            <div className="bg-dark-surface border border-brand-500/40 rounded-xl p-4 space-y-2 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping" />
                  🚀 Update Available: v{version || '2.2.0'}
                </span>
                <span className="text-[10px] text-gray-400">Just now</span>
              </div>
              <p className="text-xs font-semibold text-gray-200">{title}</p>
              <p className="text-[11px] text-gray-400 line-clamp-2">
                {changelog.split('\n')[0] || 'Tap to download the latest update.'}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center text-[11px] font-bold text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-md border border-brand-500/20">
                  Tap to Install (.APK) →
                </span>
              </div>
            </div>
          </div>

          {/* Instant Admin Notification Broadcast Form */}
          <div className="bg-dark-card border border-brand-500/30 rounded-2xl p-6 shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-400" />
                <span>Instant Broadcast Notification to All Users</span>
              </h3>
              <span className="text-[10px] bg-brand-500/20 text-brand-400 font-extrabold px-2 py-0.5 rounded-full border border-brand-500/30">
                {totalUsers} Users
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Broadcast an immediate notification alert to every registered user on MovieBuzz to install the new app release:
            </p>

            <form onSubmit={handleBroadcastOnly} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  placeholder="e.g. 🔥 New App Update v2.4.0 is Ready to Install!"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">
                  Notification Body Message
                </label>
                <textarea
                  value={quickBody}
                  onChange={(e) => setQuickBody(e.target.value)}
                  rows={2}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 resize-none"
                  placeholder="e.g. Experience zero-lag background stream buffering & sponsor cinema video ad. Tap here to install!"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">
                  Target Route / Link
                </label>
                <input
                  type="text"
                  value={quickLink}
                  onChange={(e) => setQuickLink(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  placeholder="/download"
                />
              </div>

              <button
                type="submit"
                disabled={broadcastMutation.isPending}
                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-brand-500 to-amber-600 hover:from-brand-600 hover:to-amber-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-50"
              >
                {broadcastMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Notification to All Users...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Notification to All Users</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              Direct Installation Test
            </h3>
            <p className="text-xs text-gray-400">
              Verify that the APK download file is served directly from the server:
            </p>

            <a
              href={downloadUrl}
              download="moviebuzz.apk"
              className="w-full flex items-center justify-center space-x-2 py-3 bg-dark-surface hover:bg-dark-hover border border-dark-border text-white text-xs font-bold rounded-xl transition-colors"
            >
              <Download className="w-4 h-4 text-brand-400" />
              <span>Test Download ({downloadUrl})</span>
            </a>
          </div>
        </div>
      </div>

      {/* Release History Table */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-brand-400" />
            Application Release History
          </h2>
          <span className="text-xs text-gray-400">{updates.length} releases logged</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-xs">Loading releases...</div>
        ) : updates.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-xs">
            No custom app updates created yet. The default release v2.2.0 is currently served.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-surface text-gray-400 uppercase font-semibold border-b border-dark-border">
                <tr>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Headline</th>
                  <th className="py-3 px-4">Release Date</th>
                  <th className="py-3 px-4">Users Notified</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/50 text-gray-300">
                {updates.map((item) => (
                  <tr key={item._id} className="hover:bg-dark-surface/40">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <span>v{item.version}</span>
                      {item.isMandatory && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                          Mandatory
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate">{item.title}</td>
                    <td className="py-3.5 px-4 text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-white">{item.usersNotifiedCount}</span> users
                    </td>
                    <td className="py-3.5 px-4">
                      {item.isActive ? (
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30">
                          Active Live
                        </span>
                      ) : (
                        <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[10px]">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item._id && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete release v${item.version}?`)) {
                              deleteMutation.mutate(item._id!);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-dark-surface transition-colors"
                          title="Delete release record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
