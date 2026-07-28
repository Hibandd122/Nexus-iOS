
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  Alert, Dimensions, StatusBar, Animated, Easing, KeyboardAvoidingView, Platform, SafeAreaView, Modal, AppState, ActivityIndicator
} from 'react-native';
// SDK 56 keeps the string-based FileSystem API under the legacy entrypoint.
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import EventSource from 'react-native-sse';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import DownloadHUD from './src/components/DownloadHUD';
import TikTokDownloader, { arrayBufferToBase64 } from './src/components/TikTokDownloader';
import MangaPreviewModal from './src/components/MangaPreviewModal';
import { dohFetch, DNS_PROVIDERS } from './src/utils/dns';
import { calculateStorageUsage, formatBytes, exportChapterAsCBZ, cleanupExpiredChapters } from './src/utils/storage';

const DEFAULT_BACKEND_URL = "https://mahirun.hicanh69.workers.dev";
const CATALOG_API_URL = "https://mangadex-bypass.vercel.app";
const { width } = Dimensions.get('window');

export default function App() {
  // Navigation Tabs: 'manga' | 'tiktok' | 'library'
  const [activeTab, setActiveTab] = useState('manga');
  
  // Custom Settings State
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [selectedDNS, setSelectedDNS] = useState(DNS_PROVIDERS[0]);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Manga Preview Modal State
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewChapId, setPreviewChapId] = useState(null);

  // Direct Link Downloader State
  const [urlInput, setUrlInput] = useState('');
  const [chapterPickerVisible, setChapterPickerVisible] = useState(false);
  const [chapterPickerLoading, setChapterPickerLoading] = useState(false);
  const [chapterPickerError, setChapterPickerError] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterOptions, setChapterOptions] = useState([]);

  // HUD & Translation Task State
  const [hudVisible, setHudVisible] = useState(false);
  const [hudStatusText, setHudStatusText] = useState('');
  const [hudProgress, setHudProgress] = useState(0);
  const [hudComplete, setHudComplete] = useState(false);
  const [hudError, setHudError] = useState(false);
  const [hudChapTitle, setHudChapTitle] = useState('');
  const [lastDownloadedChapId, setLastDownloadedChapId] = useState(null);

  // Saved Chapters & Storage State
  const [savedChapters, setSavedChapters] = useState([]);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);
  const [selectedMangaTitle, setSelectedMangaTitle] = useState(null);

  // AppState for Background Stream Execution
  const appStateRef = useRef(AppState.currentState);
  const activeSseRef = useRef(null);
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSavedChapters();
    
    // Background execution AppState listener
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[Nexus-iOS] App state returned to active foreground');
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[Nexus-iOS] App state moved to background. Keeping SSE stream & background downloads active...');
      }
      appStateRef.current = nextAppState;
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
      ])
    ).start();

    return () => {
      subscription.remove();
    };
  }, []);

  const getChapDir = () => FileSystem.documentDirectory + 'manga_chapters/';

  const loadSavedChapters = async () => {
    try {
      const dir = getChapDir();
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      await cleanupExpiredChapters();
      const files = await FileSystem.readDirectoryAsync(dir);
      files.sort((a, b) => b.localeCompare(a));
      setSavedChapters(files);

      const usage = await calculateStorageUsage();
      setTotalStorageBytes(usage.totalBytes);
    } catch (e) {
      console.log("Error loading chapters", e);
    }
  };

  const getChapterDisplayName = (folderName) =>
    folderName.replace(/_\d{1,2}h\d{1,2}$/, '').trim();

  const getMangaTitleFromFolder = (folderName) => {
    const chapterMarker = getChapterDisplayName(folderName).indexOf(' - Chapter ');
    if (chapterMarker > 0) {
      return getChapterDisplayName(folderName).slice(0, chapterMarker).trim();
    }
    return getChapterDisplayName(folderName);
  };

  const groupedManga = savedChapters.reduce((groups, folderName) => {
    const mangaTitle = getMangaTitleFromFolder(folderName);
    if (!groups[mangaTitle]) groups[mangaTitle] = [];
    groups[mangaTitle].push(folderName);
    return groups;
  }, {});

  const mangaTitles = Object.keys(groupedManga).sort((a, b) => a.localeCompare(b));

  const extractChapInfo = (url) => {
    try {
      const parts = url.split('/');
      const chapIdx = parts.indexOf('chapter');
      if (chapIdx !== -1 && parts.length > chapIdx + 1) {
        return parts[chapIdx + 1].substring(0, 8);
      }
    } catch (e) {}
    return Date.now().toString().substring(6);
  };

  const extractChapterId = (url) => {
    const match = String(url).match(/mangadex\.org\/chapter\/([0-9a-f-]{36})/i);
    return match ? match[1] : null;
  };

  const sanitizeChapterTitle = (value, fallbackSource = '') => {
    const cleaned = String(value || '')
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.slice(0, 80) || `Truyen_${extractChapInfo(fallbackSource || urlInput)}`;
  };

  const resolveMangaTitle = async (targetUrl) => {
    const chapterId = extractChapterId(targetUrl);
    if (!chapterId) return `Truyen_${extractChapInfo(targetUrl)}`;

    try {
      const response = await dohFetch(
        `https://api.mangadex.org/chapter/${chapterId}?includes[]=manga`
      );
      if (!response.ok) throw new Error(`MangaDex title HTTP ${response.status}`);

      const data = await response.json();
      const manga = data?.data?.relationships?.find((item) => item.type === 'manga');
      const titles = manga?.attributes?.title || {};
      const title = titles.vi || titles.en || titles['ja-ro'] || Object.values(titles)[0];
      return sanitizeChapterTitle(title, targetUrl);
    } catch (error) {
      console.warn('Không lấy được tên truyện từ MangaDex:', error.message);
      return `Truyen_${extractChapInfo(targetUrl)}`;
    }
  };

  const handleUrlChange = (value) => {
    setUrlInput(value);
    setChapterOptions([]);
    setChapterPickerError('');
  };

  const loadChaptersForTitle = async () => {
    const titleUrl = urlInput.trim();
    if (!titleUrl.includes('mangadex.org/title/')) {
      startTranslation(titleUrl);
      return;
    }

    setChapterPickerVisible(true);
    setChapterPickerLoading(true);
    setChapterPickerError('');
    try {
      const response = await dohFetch(
        `${CATALOG_API_URL}/api/chapters?url=${encodeURIComponent(titleUrl)}`
      );
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.chapters)) {
        throw new Error(data.error || `API chapter HTTP ${response.status}`);
      }
      setChapterTitle(data.mangaTitle || 'Chọn chapter');
      setChapterOptions(data.chapters);
    } catch (error) {
      setChapterPickerError(error.message || 'Không thể tải danh sách chapter');
    } finally {
      setChapterPickerLoading(false);
    }
  };

  const selectChapter = (chapter) => {
    const selectedUrl = `https://mangadex.org/chapter/${chapter.id}`;
    const selectedChapterLabel = chapter.chapter || 'Oneshot';
    const selectedTitle = chapter.title ? ` - ${chapter.title}` : '';
    setUrlInput(selectedUrl);
    setChapterPickerVisible(false);
    startTranslation(
      selectedUrl,
      sanitizeChapterTitle(`${chapterTitle} - Chapter ${selectedChapterLabel}${selectedTitle}`, selectedUrl)
    );
  };

  // Trigger MangaDex Batch Translation Engine with Background Stream support
  const startTranslation = async (targetUrl, customChapTitle = '') => {
    if (!targetUrl.includes('mangadex.org')) {
      Alert.alert('NEXUS VIP', 'Chỉ hỗ trợ liên kết MangaDex (https://mangadex.org/chapter/...).');
      return;
    }

    let title = customChapTitle || `Truyen_${extractChapInfo(targetUrl)}`;
    setHudChapTitle(title);
    setHudVisible(true);
    setHudComplete(false);
    setHudError(false);
    setHudProgress(0.05);
    setHudStatusText('Đang kết nối Nexus Stream Engine (Hỗ trợ chạy ngầm)...');

    try {
      if (!customChapTitle) {
        setHudStatusText('Đang lấy tên truyện từ MangaDex...');
        title = await resolveMangaTitle(targetUrl);
        setHudChapTitle(title);
      }

      const formData = new FormData();
      formData.append("url", targetUrl);
      formData.append("prompt_mode", "none");

      const response = await dohFetch(`${backendUrl}/manga-auto-exec`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server status ${response.status}`);
      }

      setHudStatusText('Đang chờ Server dịch AI (Có thể thoát app chạy ngầm)...');
      setHudProgress(0.15);

      const source = new EventSource(`${backendUrl}/manga-progress`);
      activeSseRef.current = source;

      const timeoutTimer = setTimeout(() => {
        source.close();
        setHudStatusText('Lỗi: Quá thời gian phản hồi (Timeout 3 phút)');
        setHudError(true);
      }, 180000);

      source.addEventListener('message', async (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          setHudStatusText(data.current || 'Đang xử lý...');

          if (data.total > 0) {
            const calculatedProgress = 0.15 + (data.done / data.total) * 0.7;
            setHudProgress(calculatedProgress);
          }

          if (data.status === 'complete' || data.status === 'error') {
            clearTimeout(timeoutTimer);
            source.close();
            activeSseRef.current = null;

            if (data.status === 'complete' && data.download_link) {
              await downloadAndExtractZip(data.download_link, title);
            } else {
              setHudStatusText('Lỗi: Server dịch ảnh không thành công!');
              setHudError(true);
            }
          }
        } catch (e) {
          console.error("SSE parse error", e);
        }
      });

      source.addEventListener('error', (err) => {
        clearTimeout(timeoutTimer);
        source.close();
        activeSseRef.current = null;
        setHudStatusText('Mất kết nối Stream với Server');
        setHudError(true);
      });

    } catch (error) {
      setHudStatusText('Không thể kết nối tới Server Nexus!');
      setHudError(true);
    }
  };

  // Modern In-Memory Stream Zip Fetcher without FileSystem.downloadAsync Deprecation Issue
  const downloadAndExtractZip = async (filename, chapTitle) => {
    try {
      setHudStatusText('Đang kết nối luồng tải tệp CBZ...');
      setHudProgress(0.82);

      const downloadRes = await dohFetch(`${backendUrl}/download/${filename}`);

      if (!downloadRes.ok) {
        throw new Error(`Server trả về mã lỗi HTTP ${downloadRes.status}`);
      }

      setHudStatusText('Đang tải dữ liệu nhị phân tệp ZIP...');
      setHudProgress(0.86);

      const arrayBuf = await downloadRes.arrayBuffer();

      setHudStatusText('Đang chuyển đổi tệp ZIP vào bộ nhớ...');
      setHudProgress(0.89);

      const zipBytes = new Uint8Array(arrayBuf);
      const hasZipSignature = zipBytes.length >= 4 &&
        zipBytes[0] === 0x50 && zipBytes[1] === 0x4b &&
        (zipBytes[2] === 0x03 || zipBytes[2] === 0x05 || zipBytes[2] === 0x07) &&
        (zipBytes[3] === 0x04 || zipBytes[3] === 0x06 || zipBytes[3] === 0x08);

      if (!hasZipSignature) {
        throw new Error("Tệp ZIP chưa được tạo xong hoặc link bị lỗi HTML 404/500");
      }

      setHudStatusText('Đang bung nén ảnh vào storage...');
      setHudProgress(0.92);

      // Let JSZip parse the binary directly; converting a large archive to base64
      // doubles memory usage and can corrupt the payload on Hermes.
      const zip = await JSZip.loadAsync(arrayBuf);

      const now = new Date();
      const timeStr = `${now.getHours()}h${now.getMinutes()}`;
      const chapFolderId = `${chapTitle}_${timeStr}`;

      const extractDir = getChapDir() + chapFolderId + '/';
      await FileSystem.makeDirectoryAsync(extractDir, { intermediates: true });

      const files = Object.values(zip.files).filter(f => !f.dir);
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      let count = 0;
      for (const file of files) {
        const base64Data = await file.async("base64");
        // ZIP entries may contain folders. Keep extraction inside the chapter
        // directory and create each parent before writing the image.
        const relativeName = file.name.replace(/\\/g, '/').replace(/^\/+/, '');
        const parts = relativeName.split('/').filter(part => part && part !== '.' && part !== '..');
        if (parts.length === 0) continue;
        const outputUri = extractDir + parts.join('/');
        const parentParts = parts.slice(0, -1);
        if (parentParts.length > 0) {
          await FileSystem.makeDirectoryAsync(
            extractDir + parentParts.join('/') + '/',
            { intermediates: true }
          );
        }
        await FileSystem.writeAsStringAsync(outputUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        count++;
        const writeProgress = 0.92 + (count / files.length) * 0.08;
        setHudProgress(writeProgress);
        setHudStatusText(`Đang ghi dữ liệu: ${count}/${files.length} trang`);
      }

      setHudProgress(1.0);
      setHudStatusText('HOÀN TẤT VIP! Chapter đã lưu trữ thành công');
      setHudComplete(true);
      setLastDownloadedChapId(chapFolderId);

      loadSavedChapters();
    } catch (e) {
      setHudStatusText(`Lỗi giải nén: ${e.message || "Tệp ZIP hỏng"}`);
      setHudError(true);
    }
  };

  const cancelTask = () => {
    if (activeSseRef.current) {
      activeSseRef.current.close();
      activeSseRef.current = null;
    }
    setHudVisible(false);
    setHudProgress(0);
    setHudStatusText('');
  };

  const handleExportCBZ = async (chapId) => {
    try {
      await exportChapterAsCBZ(chapId);
    } catch (e) {
      Alert.alert("Lỗi xuất CBZ", e.message || "Không thể xuất tệp CBZ.");
    }
  };

  const openPreviewModal = (chapId) => {
    setPreviewChapId(chapId);
    setPreviewModalVisible(true);
  };

  const deleteChapter = async (chapId) => {
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc muốn xóa vĩnh viễn chapter "${chapId}" khỏi máy?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          onPress: async () => {
            const dir = getChapDir() + chapId;
            await FileSystem.deleteAsync(dir, { idempotent: true });
            loadSavedChapters();
          },
          style: 'destructive'
        }
      ]
    );
  };

  const clearAllChapters = async () => {
    Alert.alert(
      "CẢNH BÁO: DỌN BỘ NHỚ",
      "Bạn có chắc chắn muốn xóa TOÀN BỘ các chapter đã lưu trong máy?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "XÓA TẤT CẢ",
          onPress: async () => {
            const dir = getChapDir();
            await FileSystem.deleteAsync(dir, { idempotent: true });
            setSelectedMangaTitle(null);
            loadSavedChapters();
          },
          style: 'destructive'
        }
      ]
    );
  };

  const glowBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 229, 255, 0.2)', 'rgba(0, 229, 255, 0.8)']
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />

      <View pointerEvents="none" style={styles.backgroundGlowTop} />
      <View pointerEvents="none" style={styles.backgroundGlowBottom} />

      {/* Extension-Style Floating HUD Overlay */}
      <DownloadHUD
        visible={hudVisible}
        statusText={hudStatusText}
        progress={hudProgress}
        isComplete={hudComplete}
        isError={hudError}
        chapTitle={hudChapTitle}
        onCancel={cancelTask}
        onOpenLibrary={() => {
          setHudVisible(false);
          if (lastDownloadedChapId) {
            openPreviewModal(lastDownloadedChapId);
          } else {
            setActiveTab('library');
          }
        }}
      />

      {/* Full Gallery Manga Preview Modal */}
      <MangaPreviewModal
        visible={previewModalVisible}
        chapId={previewChapId}
        onClose={() => setPreviewModalVisible(false)}
        onExportCBZ={(chapId) => handleExportCBZ(chapId)}
      />

      <Modal
        visible={chapterPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChapterPickerVisible(false)}
      >
        <View style={styles.chapterPickerOverlay}>
          <View style={styles.chapterPickerCard}>
            <View style={styles.chapterPickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chapterPickerKicker}>CHAPTER SELECTOR</Text>
                <Text style={styles.chapterPickerTitle} numberOfLines={2}>
                  {chapterTitle || 'Danh sách chapter'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setChapterPickerVisible(false)} style={styles.chapterPickerClose}>
                <Feather name="x" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {chapterPickerLoading ? (
              <View style={styles.chapterPickerState}>
                <ActivityIndicator color="#00e5ff" />
                <Text style={styles.chapterPickerStateText}>Đang tải danh sách chapter...</Text>
              </View>
            ) : chapterPickerError ? (
              <View style={styles.chapterPickerState}>
                <Feather name="alert-circle" size={24} color="#f43f5e" />
                <Text style={styles.chapterPickerError}>{chapterPickerError}</Text>
              </View>
            ) : (
              <FlatList
                data={chapterOptions}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                renderItem={({ item, index }) => (
                  <TouchableOpacity style={styles.chapterOption} onPress={() => selectChapter(item)} activeOpacity={0.75}>
                    <View style={styles.chapterNumber}>
                      <Text style={styles.chapterNumberText}>{item.chapter || index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chapterOptionTitle} numberOfLines={1}>
                        {item.title || `Chapter ${item.chapter || index + 1}`}
                      </Text>
                      <Text style={styles.chapterOptionMeta}>
                        {item.pages || 0} trang {item.volume ? `• Volume ${item.volume}` : ''}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={17} color="#64748b" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Main VIP Header Bar */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="hexagon" size={26} color="#00e5ff" style={{ marginRight: 8 }} />
            <Text style={styles.brandTitle}>NEXUS<Text style={{ color: '#ffffff' }}>_iOS</Text></Text>
            <View style={styles.vipBadge}>
              <Text style={styles.vipText}>VIP PRO</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => setSettingsModalVisible(true)} style={styles.settingsBtn}>
            <Feather name="sliders" size={18} color="#00e5ff" />
          </TouchableOpacity>
        </View>

        {/* Segmented Navigation Tabs */}
        <View style={styles.navTabs}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'manga' && styles.tabBtnActive]}
            onPress={() => setActiveTab('manga')}
          >
            <Feather name="zap" size={15} color={activeTab === 'manga' ? '#00e5ff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'manga' && styles.tabTextActive]}>Dịch Manga</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'tiktok' && styles.tabBtnTikTokActive]}
            onPress={() => setActiveTab('tiktok')}
          >
            <Feather name="video" size={15} color={activeTab === 'tiktok' ? '#ec4899' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'tiktok' && styles.tabTextTikTokTextActive]}>TikTok DL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'library' && styles.tabBtnLibraryActive]}
            onPress={() => setActiveTab('library')}
          >
            <Feather name="hard-drive" size={15} color={activeTab === 'library' ? '#10b981' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'library' && styles.tabTextLibraryTextActive]}>
              Thư Viện ({savedChapters.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab 1: Manga Batch Translator */}
      {activeTab === 'manga' && (
        <View style={styles.tabContentContainer}>
          <View style={styles.heroBlock}>
            <View style={styles.heroEyebrow}>
              <View style={styles.liveDot} />
              <Text style={styles.heroEyebrowText}>NEXUS WORKSPACE</Text>
            </View>
            <Text style={styles.heroTitle}>Biến chapter thành trải nghiệm đọc của bạn.</Text>
            <Text style={styles.heroDescription}>
              Dịch hàng loạt, lưu offline và mở lại mọi chapter trong một không gian riêng tư.
            </Text>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.glassPanel}>
              <LinearGradient
                colors={['#00e5ff', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topGradientBar}
              />

              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>BATCH MANGA TRANSLATOR VIP</Text>
                <View style={styles.dnsBadge}>
                  <Feather name="shield" size={11} color="#10b981" style={{ marginRight: 4 }} />
                  <Text style={styles.dnsBadgeText}>{selectedDNS.id}</Text>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Dán link MangaDex (https://mangadex.org/chapter/...)"
                  placeholderTextColor="#475569"
                  value={urlInput}
                  onChangeText={handleUrlChange}
                  editable={!hudVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {urlInput ? (
                  <TouchableOpacity style={styles.clearInputBtn} onPress={() => setUrlInput('')}>
                    <Feather name="x-circle" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={() => {
                   if (urlInput) loadChaptersForTitle();
                }}
                disabled={hudVisible || !urlInput}
              >
                <Animated.View style={[styles.btnGlowWrapper, { borderColor: urlInput && !hudVisible ? glowBorderColor : '#333' }]}>
                  <LinearGradient
                    colors={hudVisible ? ['#334155', '#1e293b'] : ['#00e5ff', '#0097a7']}
                    style={styles.btn}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    <Feather name={urlInput.includes('/title/') ? 'list' : 'download-cloud'} size={18} color="#000" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>{hudVisible ? 'ĐANG XỬ LÝ HUD...' : urlInput.includes('/title/') ? 'CHỌN CHAPTER ĐỂ DỊCH' : '⚡ KÍCH HOẠT NEXUS BATCH ENGINE'}</Text>
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Feather name="zap" size={16} color="#00e5ff" style={{ marginRight: 8 }} />
            <Text style={styles.infoText}>
              Hỗ trợ chạy ngầm liên tục khi chuyển sang ứng dụng khác. Tiến trình dịch AI & tải file ZIP sẽ tự động hoàn tất trong background.
            </Text>
          </View>
        </View>
      )}

      {/* Tab 2: TikTok Downloader */}
      {activeTab === 'tiktok' && (
        <TikTokDownloader backendUrl={backendUrl} />
      )}

      {/* Tab 3: Offline Library & Storage Management */}
      {activeTab === 'library' && (
        <View style={styles.tabContentContainer}>
          <View style={styles.libraryIntro}>
            <Text style={styles.sectionKicker}>OFFLINE LIBRARY</Text>
            <Text style={styles.libraryTitle}>Kho đọc của bạn</Text>
            <Text style={styles.libraryDescription}>Mọi chapter đã dịch, luôn sẵn sàng khi không có mạng.</Text>
          </View>

          {/* Storage Meter Banner */}
          <View style={styles.storageMeterCard}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topGradientBar}
            />

            <View style={styles.storageHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="hard-drive" size={18} color="#10b981" style={{ marginRight: 8 }} />
                <Text style={styles.storageTitle}>DUNG LƯỢNG LƯU TRỮ</Text>
              </View>
              <Text style={styles.storageValue}>{formatBytes(totalStorageBytes)}</Text>
            </View>

            {savedChapters.length > 0 && (
              <TouchableOpacity onPress={clearAllChapters} style={styles.clearAllBtn}>
                <Feather name="trash-2" size={12} color="#f43f5e" style={{ marginRight: 4 }} />
                <Text style={styles.clearAllText}>Dọn sạch bộ nhớ ({savedChapters.length} Chap)</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.libraryHeader}>
            {selectedMangaTitle ? (
              <TouchableOpacity style={styles.libraryBackBtn} onPress={() => setSelectedMangaTitle(null)}>
                <Feather name="chevron-left" size={16} color="#00e5ff" />
                <Text style={styles.libraryBackText}>Tất cả truyện</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.subtitle}>TRUYỆN ĐÃ DỊCH ({mangaTitles.length})</Text>
            )}
          </View>

          {savedChapters.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color="#334155" />
              <Text style={styles.emptyText}>Chưa có chapter nào được lưu</Text>
              <Text style={styles.emptySub}>Nhập Link MangaDex để bắt đầu dịch</Text>
            </View>
          ) : selectedMangaTitle ? (
            <FlatList
              data={groupedManga[selectedMangaTitle] || []}
              keyExtractor={item => item}
              style={{ width: '100%' }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={styles.chapCard}>
                  <TouchableOpacity style={styles.chapBtn} onPress={() => openPreviewModal(item)}>
                    <View style={styles.chapIconWrap}>
                      <Feather name="grid" size={20} color="#00e5ff" />
                    </View>
                    <View style={styles.chapInfo}>
                      <Text style={styles.chapText} numberOfLines={1}>{getChapterDisplayName(item)}</Text>
                      <Text style={styles.chapSub}>Nhấn để mở chapter và đọc ảnh</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity style={styles.exportBtn} onPress={() => handleExportCBZ(item)}>
                      <Feather name="share" size={15} color="#00e5ff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.delBtn} onPress={() => deleteChapter(item)}>
                      <Feather name="trash-2" size={15} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          ) : (
            <FlatList
              data={mangaTitles}
              keyExtractor={item => item}
              style={{ width: '100%' }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40, gap: 11 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.mangaCard} onPress={() => setSelectedMangaTitle(item)} activeOpacity={0.78}>
                  <View style={styles.mangaIconWrap}>
                    <Feather name="book-open" size={21} color="#00e5ff" />
                  </View>
                  <View style={styles.mangaInfo}>
                    <Text style={styles.mangaCardTitle} numberOfLines={2}>{item}</Text>
                    <Text style={styles.mangaCardMeta}>{groupedManga[item].length} chapter đã dịch • Giữ 7 ngày</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#64748b" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* Advanced Settings Modal */}
      <Modal visible={settingsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>CÀI ĐẶT NÂNG CAO VIP</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Feather name="x" size={20} color="#f43f5e" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Địa chỉ Nexus Worker Backend</Text>
            <TextInput
              style={styles.modalInput}
              value={backendUrl}
              onChangeText={setBackendUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>DNS Provider (Bypass ISP Block)</Text>
            {DNS_PROVIDERS.map((dns) => (
              <TouchableOpacity
                key={dns.id}
                style={[styles.dnsOption, selectedDNS.id === dns.id && styles.dnsOptionActive]}
                onPress={() => setSelectedDNS(dns)}
              >
                <Feather
                  name={selectedDNS.id === dns.id ? "check-circle" : "circle"}
                  size={16}
                  color={selectedDNS.id === dns.id ? "#00e5ff" : "#64748b"}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.dnsOptionText}>{dns.name} ({dns.id})</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.saveSettingsBtn} onPress={() => setSettingsModalVisible(false)}>
              <Text style={styles.saveSettingsText}>LƯU & ĐÓNG</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050505',
  },
  backgroundGlowTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    top: -150,
    right: -90,
  },
  backgroundGlowBottom: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
    bottom: -100,
    left: -100,
  },
  header: {
    backgroundColor: 'rgba(10, 12, 16, 0.94)',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 8,
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#00e5ff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1.2,
  },
  vipBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00e5ff',
    marginLeft: 8,
  },
  vipText: {
    color: '#00e5ff',
    fontSize: 9,
    fontWeight: '900',
  },
  settingsBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  navTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  tabBtnTikTokActive: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.4)',
  },
  tabBtnLibraryActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  tabText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#00e5ff',
  },
  tabTextTikTokTextActive: {
    color: '#ec4899',
  },
  tabTextLibraryTextActive: {
    color: '#10b981',
  },
  tabContentContainer: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
  },
  heroBlock: {
    paddingHorizontal: 2,
    marginBottom: 20,
  },
  heroEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#00e5a8',
  },
  heroEyebrowText: {
    color: '#00e5a8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroTitle: {
    maxWidth: 340,
    color: '#f8fafc',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroDescription: {
    maxWidth: 350,
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  glassPanel: {
    width: '100%',
    backgroundColor: 'rgba(19, 27, 46, 0.78)',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.22)',
    marginBottom: 14,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  topGradientBar: {
    height: 3,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  panelTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dnsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  dnsBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  input: {
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    color: '#00e5ff',
    padding: 15,
    paddingRight: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  clearInputBtn: {
    position: 'absolute',
    top: 13,
    right: 12,
  },
  btnGlowWrapper: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 2,
  },
  btn: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  infoText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  storageMeterCard: {
    backgroundColor: 'rgba(19, 27, 46, 0.78)',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  storageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  storageTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  storageValue: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  clearAllText: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: '700',
  },
  libraryHeader: {
    marginBottom: 10,
  },
  libraryBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 5,
    paddingRight: 10,
  },
  libraryBackText: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '800',
  },
  libraryIntro: {
    marginBottom: 18,
  },
  sectionKicker: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  libraryTitle: {
    color: '#f8fafc',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  libraryDescription: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 50,
  },
  emptyText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    color: '#475569',
    marginTop: 6,
    fontSize: 12,
  },
  chapCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(19, 27, 46, 0.68)',
    padding: 13,
    borderRadius: 18,
    marginBottom: 11,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  chapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chapInfo: {
    flex: 1,
  },
  chapText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  chapSub: {
    color: '#64748b',
    fontSize: 11,
  },
  mangaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(19, 27, 46, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  mangaIconWrap: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.11)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.24)',
  },
  mangaInfo: {
    flex: 1,
  },
  mangaCardTitle: {
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  mangaCardMeta: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 5,
  },
  exportBtn: {
    padding: 9,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 8,
    marginLeft: 6,
  },
  delBtn: {
    padding: 9,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: 8,
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  settingsModalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#00e5ff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#00e5ff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#00e5ff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    marginBottom: 10,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dnsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 8,
  },
  dnsOptionActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00e5ff',
  },
  dnsOptionText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  saveSettingsBtn: {
    marginTop: 16,
    backgroundColor: '#00e5ff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveSettingsText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1,
  },
  chapterPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  chapterPickerCard: {
    maxHeight: '82%',
    backgroundColor: '#101827',
    padding: 18,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  chapterPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  chapterPickerKicker: {
    color: '#00e5a8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  chapterPickerTitle: {
    color: '#f8fafc',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
  },
  chapterPickerClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  chapterPickerState: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  chapterPickerStateText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  chapterPickerError: {
    color: '#fda4af',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  chapterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  chapterNumber: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  chapterNumberText: {
    color: '#00e5ff',
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  chapterOptionTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  chapterOptionMeta: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
  },
});
