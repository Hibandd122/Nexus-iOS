import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

const getChapDir = () => FileSystem.documentDirectory + 'manga_chapters/';
const isImageFile = (name) => /\.(jpe?g|png|webp|gif|avif)$/i.test(name);
const CHAPTER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function cleanupExpiredChapters() {
  const rootDir = getChapDir();
  const rootInfo = await FileSystem.getInfoAsync(rootDir);
  if (!rootInfo.exists) return 0;

  const now = Date.now();
  const entries = await FileSystem.readDirectoryAsync(rootDir);
  let removedCount = 0;

  for (const entry of entries) {
    const entryUri = `${rootDir}${entry}`;
    const info = await FileSystem.getInfoAsync(entryUri);
    const lastChanged = (info.modificationTime || info.creationTime || 0) * 1000;
    if (info.isDirectory && lastChanged > 0 && now - lastChanged >= CHAPTER_RETENTION_MS) {
      await FileSystem.deleteAsync(entryUri, { idempotent: true });
      removedCount++;
    }
  }

  return removedCount;
}

async function walkFiles(directoryUri, relativePrefix = '') {
  const entries = await FileSystem.readDirectoryAsync(directoryUri);
  const files = [];

  for (const entry of entries) {
    const entryUri = directoryUri + entry;
    const info = await FileSystem.getInfoAsync(entryUri);
    if (info.isDirectory) {
      files.push(...await walkFiles(`${entryUri}/`, `${relativePrefix}${entry}/`));
    } else {
      files.push({ name: `${relativePrefix}${entry}`, uri: entryUri, info });
    }
  }

  return files;
}

/**
 * Calculates total storage used by all saved chapters
 * @returns {Promise<{ totalBytes: number, chapterDetails: Array<{ id: string, sizeBytes: number, imageCount: number }> }>}
 */
export async function calculateStorageUsage() {
  try {
    const dir = getChapDir();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      return { totalBytes: 0, chapterDetails: [] };
    }

    const chapFolders = await FileSystem.readDirectoryAsync(dir);
    let totalBytes = 0;
    const chapterDetails = [];

    for (const folder of chapFolders) {
      const folderPath = dir + folder + '/';
      const folderInfo = await FileSystem.getInfoAsync(folderPath);
      if (folderInfo.exists && folderInfo.isDirectory) {
        const files = await walkFiles(folderPath);
        let folderSize = 0;
        for (const file of files) {
          if (file.info.exists && file.info.size) {
            folderSize += file.info.size;
          }
        }
        totalBytes += folderSize;
        chapterDetails.push({
          id: folder,
          sizeBytes: folderSize,
          imageCount: files.filter(file => isImageFile(file.name)).length,
        });
      }
    }

    return { totalBytes, chapterDetails };
  } catch (error) {
    console.error('Error calculating storage:', error);
    return { totalBytes: 0, chapterDetails: [] };
  }
}

/**
 * Formats bytes to human-readable string (KB, MB, GB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Packs a downloaded chapter directory back into a CBZ file and triggers iOS native Share sheet
 */
export async function exportChapterAsCBZ(chapId) {
  try {
    const dirPath = getChapDir() + chapId + '/';
    const files = await walkFiles(dirPath);
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const zip = new JSZip();
    for (const file of files) {
      const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      zip.file(file.name, b64, { base64: true });
    }

    const zipBase64 = await zip.generateAsync({ type: 'base64' });
    const exportPath = FileSystem.cacheDirectory + `${chapId}.cbz`;
    await FileSystem.writeAsStringAsync(exportPath, zipBase64, { encoding: FileSystem.EncodingType.Base64 });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(exportPath, {
        mimeType: 'application/x-cbz',
        dialogTitle: `Xuất tệp ${chapId}.cbz`,
        UTI: 'com.pkware.zip-archive',
      });
    } else {
      throw new Error('Chia sẻ tệp không khả dụng trên thiết bị này.');
    }
  } catch (error) {
    console.error('Lỗi khi xuất CBZ:', error);
    throw error;
  }
}
