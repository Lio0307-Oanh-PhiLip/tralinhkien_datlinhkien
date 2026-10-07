/**
 * GitHub Release Automatic Update Checker Utility
 * Checks GitHub Releases API for new version updates (.exe for Windows & .deb for Linux)
 */

export interface GitHubReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
  contentType: string;
}

export interface GitHubReleaseInfo {
  tagName: string;
  version: string;
  title: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  exeAsset?: GitHubReleaseAsset;
  debAsset?: GitHubReleaseAsset;
  appImageAsset?: GitHubReleaseAsset;
  hasUpdate: boolean;
  currentVersion: string;
}

export const GITHUB_REPO_OWNER = 'philiptrinh30';
export const GITHUB_REPO_NAME = 'oppo-label-studio';
export const CURRENT_APP_VERSION = '1.0.0';

/**
 * Compare semver strings (e.g. "1.1.0" vs "1.0.0")
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const cleanV1 = v1.replace(/^v/i, '').trim();
  const cleanV2 = v2.replace(/^v/i, '').trim();

  const parts1 = cleanV1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = cleanV2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Fetch latest release from GitHub API
 */
export async function checkGitHubRelease(
  owner: string = GITHUB_REPO_OWNER,
  repo: string = GITHUB_REPO_NAME,
  currentVersion: string = CURRENT_APP_VERSION
): Promise<GitHubReleaseInfo | null> {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        console.log('[GitHub Update Check] No releases found yet on GitHub repo.');
      } else {
        console.warn(`[GitHub Update Check] HTTP ${res.status}: ${res.statusText}`);
      }
      return null;
    }

    const data = await res.json();
    const tagName: string = data.tag_name || 'v1.0.0';
    const latestVersion = tagName.replace(/^v/i, '').trim();

    let exeAsset: GitHubReleaseAsset | undefined;
    let debAsset: GitHubReleaseAsset | undefined;
    let appImageAsset: GitHubReleaseAsset | undefined;

    if (Array.isArray(data.assets)) {
      data.assets.forEach((asset: any) => {
        const nameLower = (asset.name || '').toLowerCase();
        const downloadUrl = asset.browser_download_url;
        const size = asset.size || 0;
        const contentType = asset.content_type || '';

        if (nameLower.endsWith('.exe')) {
          exeAsset = { name: asset.name, downloadUrl, size, contentType };
        } else if (nameLower.endsWith('.deb')) {
          debAsset = { name: asset.name, downloadUrl, size, contentType };
        } else if (nameLower.endsWith('.appimage')) {
          appImageAsset = { name: asset.name, downloadUrl, size, contentType };
        }
      });
    }

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    return {
      tagName,
      version: latestVersion,
      title: data.name || `Phiên bản mới ${tagName}`,
      body: data.body || 'Không có mô tả chi tiết cho bản cập nhật này.',
      publishedAt: data.published_at ? new Date(data.published_at).toLocaleDateString('vi-VN') : '',
      htmlUrl: data.html_url || `https://github.com/${owner}/${repo}/releases`,
      exeAsset,
      debAsset,
      appImageAsset,
      hasUpdate,
      currentVersion,
    };
  } catch (error) {
    console.error('[GitHub Update Check] Error checking GitHub releases:', error);
    return null;
  }
}

/**
 * Format file size in MB
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
