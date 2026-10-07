import React, { useState, useEffect } from 'react';
import {
  Download,
  Sparkles,
  RefreshCw,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Github,
} from 'lucide-react';
import {
  checkGitHubRelease,
  GitHubReleaseInfo,
  CURRENT_APP_VERSION,
  formatFileSize,
  GITHUB_REPO_OWNER,
  GITHUB_REPO_NAME,
} from '../utils/githubUpdateChecker';

interface GitHubUpdateNotifierProps {
  isOpenModal?: boolean;
  onCloseModal?: () => void;
  autoCheckOnMount?: boolean;
}

export const GitHubUpdateNotifier: React.FC<GitHubUpdateNotifierProps> = ({
  isOpenModal = false,
  onCloseModal,
  autoCheckOnMount = true,
}) => {
  const [releaseInfo, setReleaseInfo] = useState<GitHubReleaseInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Sync external trigger for explicit modal opening
  useEffect(() => {
    if (isOpenModal) {
      setShowDetailModal(true);
      performCheck();
    }
  }, [isOpenModal]);

  // Auto check on app startup
  useEffect(() => {
    if (autoCheckOnMount && !hasChecked) {
      performCheck();
    }
  }, [autoCheckOnMount, hasChecked]);

  const performCheck = async () => {
    setIsChecking(true);
    setCheckError(null);
    try {
      const info = await checkGitHubRelease();
      setReleaseInfo(info);
      setHasChecked(true);

      if (info && info.hasUpdate) {
        setIsBannerVisible(true);
      }
    } catch (err: any) {
      setCheckError(err?.message || 'Không thể kết nối đến GitHub Releases API');
    } finally {
      setIsChecking(false);
    }
  };

  const handleCloseModalInternal = () => {
    setShowDetailModal(false);
    if (onCloseModal) onCloseModal();
  };

  return (
    <>
      {/* Floating Auto-Update Banner Notification when a new release is available */}
      {isBannerVisible && releaseInfo && releaseInfo.hasUpdate && !showDetailModal && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/40 animate-bounce-short">
          <div className="flex items-start justify-between gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shrink-0 shadow-md">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Mới {releaseInfo.tagName}
                </span>
                <span className="text-xs text-stone-300 font-semibold">
                  (Hiện tại: v{CURRENT_APP_VERSION})
                </span>
              </div>

              <h4 className="text-sm font-bold text-white mt-1 truncate">
                {releaseInfo.title}
              </h4>
              <p className="text-xs text-stone-300 mt-0.5 line-clamp-2">
                {releaseInfo.body.replace(/[*#]/g, '')}
              </p>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(true)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Cập nhật ngay (.exe & .deb)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBannerVisible(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-stone-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBannerVisible(false)}
              className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full Update Details Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-400/30 text-emerald-400">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                    Kiểm Tra Bản Cập Nhật Hệ Thống
                  </h3>
                  <p className="text-xs text-stone-300">
                    Tự động đồng bộ ứng dụng với GitHub Release (.exe & .deb)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModalInternal}
                className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* App status info bar */}
              <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <div>
                  <div className="text-stone-500 font-semibold">Phiên bản hiện tại</div>
                  <div className="text-sm font-extrabold text-slate-800">
                    v{CURRENT_APP_VERSION}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-stone-500 font-semibold">Bản mới trên GitHub</div>
                  <div className="text-sm font-extrabold text-emerald-700">
                    {releaseInfo ? releaseInfo.tagName : 'Đang kiểm tra...'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={performCheck}
                  disabled={isChecking}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Bấm để kiểm tra lại từ GitHub Releases API"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'Đang check...' : 'Kiểm tra'}</span>
                </button>
              </div>

              {/* Status Message State */}
              {isChecking && (
                <div className="p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                  <div>
                    <div className="font-bold">Đang kết nối GitHub API...</div>
                    <div className="text-blue-700 text-[11px]">
                      Hệ thống đang truy vấn thông tin phát hành mới nhất từ repo{' '}
                      <strong className="font-mono">{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}</strong>
                    </div>
                  </div>
                </div>
              )}

              {checkError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-900">Không thể kết nối API</div>
                    <div className="text-rose-700 mt-0.5">{checkError}</div>
                  </div>
                </div>
              )}

              {!isChecking && releaseInfo && !releaseInfo.hasUpdate && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-extrabold text-sm text-emerald-900">
                      Hệ thống đã chuẩn hóa ở phiên bản mới nhất!
                    </div>
                    <div className="text-emerald-800 mt-0.5">
                      Bạn đang sử dụng phiên bản v{CURRENT_APP_VERSION}. Không có bản cập nhật
                      mới nào cần bổ sung.
                    </div>
                  </div>
                </div>
              )}

              {!isChecking && releaseInfo && releaseInfo.hasUpdate && (
                <div className="space-y-4">
                  {/* Banner update alert */}
                  <div className="p-3.5 bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-sm text-emerald-950">
                        Phát hiện bản cập nhật mới: {releaseInfo.tagName}
                      </div>
                      <div className="text-emerald-900 mt-0.5 font-medium">
                        Phát hành ngày: {releaseInfo.publishedAt || 'Vừa xong'}
                      </div>
                    </div>
                  </div>

                  {/* Release Notes / Changelog */}
                  <div>
                    <div className="font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Thông tin tính năng mới & Nội dung nâng cấp:</span>
                    </div>
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl max-h-40 overflow-y-auto font-mono text-[11px] text-stone-700 whitespace-pre-wrap leading-relaxed">
                      {releaseInfo.body || 'Bản phát hành chuẩn hóa định kỳ.'}
                    </div>
                  </div>

                  {/* Direct Download Files (.exe & .deb) */}
                  <div className="space-y-2">
                    <div className="font-bold text-stone-800 flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span>Tải trực tiếp bộ cài đặt ứng dụng:</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Windows Installer .exe */}
                      <a
                        href={
                          releaseInfo.exeAsset
                            ? releaseInfo.exeAsset.downloadUrl
                            : `${releaseInfo.htmlUrl}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-blue-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                          <Download className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-blue-950 truncate">
                            Windows Setup (.exe)
                          </div>
                          <div className="text-[10px] text-blue-700 font-medium">
                            {releaseInfo.exeAsset
                              ? formatFileSize(releaseInfo.exeAsset.size)
                              : 'Tải bộ cài Windows'}
                          </div>
                        </div>
                      </a>

                      {/* Linux Debian / Ubuntu .deb */}
                      <a
                        href={
                          releaseInfo.debAsset
                            ? releaseInfo.debAsset.downloadUrl
                            : releaseInfo.appImageAsset
                            ? releaseInfo.appImageAsset.downloadUrl
                            : `${releaseInfo.htmlUrl}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer group"
                      >
                        <div className="p-2 bg-purple-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                          <Download className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-purple-950 truncate">
                            Linux Package (.deb)
                          </div>
                          <div className="text-[10px] text-purple-700 font-medium">
                            {releaseInfo.debAsset
                              ? formatFileSize(releaseInfo.debAsset.size)
                              : releaseInfo.appImageAsset
                              ? formatFileSize(releaseInfo.appImageAsset.size)
                              : 'Tải gói Linux Debian/Ubuntu'}
                          </div>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* GitHub Link Footer */}
              <div className="p-3 bg-stone-100/70 rounded-xl border border-stone-200 flex items-center justify-between gap-2 text-[11px] text-stone-600">
                <div className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Mọi bản phát hành được tự động kiểm thử & đóng gói bởi GitHub Actions.</span>
                </div>

                {releaseInfo && (
                  <a
                    href={releaseInfo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-700 font-bold hover:underline shrink-0 flex items-center gap-1"
                  >
                    <span>Xem GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseModalInternal}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
