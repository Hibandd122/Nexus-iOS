import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform, Animated, Modal, FlatList
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { INJECTED_DNS_SCRIPT, measureDNSLatency } from '../utils/dns';

const DEFAULT_URL = 'https://mangadex.org/';

const QUICK_LINKS = [
  { label: 'Trang chủ', url: 'https://mangadex.org/', icon: 'home' },
  { label: 'Nổi bật', url: 'https://mangadex.org/titles?page=1&order[followedCount]=desc', icon: 'trending-up' },
  { label: 'Mới cập nhật', url: 'https://mangadex.org/titles/latest', icon: 'clock' },
];

/**
 * VIP MangaDex WebView Component
 */
export default function MangaDexWebView({ onTriggerDownload, useCloudflareDNS, onToggleDNS }) {
  const webViewRef = useRef(null);
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [dnsPing, setDnsPing] = useState(0);

  // Bookmarks Modal State
  const [bookmarksModalVisible, setBookmarksModalVisible] = useState(false);
  const [bookmarks, setBookmarks] = useState([
    { title: 'MangaDex Home', url: 'https://mangadex.org/' },
  ]);

  // Pulse Animation for FAB
  const fabPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (useCloudflareDNS) {
      measureDNSLatency().then(ms => setDnsPing(ms));
    }
  }, [useCloudflareDNS]);

  const isChapterPage = currentUrl.includes('mangadex.org/chapter');

  useEffect(() => {
    if (isChapterPage) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(fabPulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(fabPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isChapterPage]);

  const handleNavigationStateChange = (navState) => {
    setCurrentUrl(navState.url);
    setInputUrl(navState.url);
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setLoading(navState.loading);
  };

  const handleLoadUrl = () => {
    let target = inputUrl.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    setCurrentUrl(target);
  };

  const toggleBookmark = () => {
    const exists = bookmarks.some(b => b.url === currentUrl);
    if (exists) {
      setBookmarks(bookmarks.filter(b => b.url !== currentUrl));
    } else {
      setBookmarks([...bookmarks, { title: currentUrl.replace('https://mangadex.org/', ''), url: currentUrl }]);
    }
  };

  const extractChapInfo = (url) => {
    try {
      const parts = url.split('/');
      const chapIdx = parts.indexOf('chapter');
      if (chapIdx !== -1 && parts.length > chapIdx + 1) {
        return parts[chapIdx + 1].substring(0, 8);
      }
    } catch (e) {}
    return 'Chap';
  };

  const isBookmarked = bookmarks.some(b => b.url === currentUrl);

  return (
    <View style={styles.container}>
      {/* Top WebView Control Bar */}
      <View style={styles.toolbar}>
        <View style={styles.navControls}>
          <TouchableOpacity
            disabled={!canGoBack}
            onPress={() => webViewRef.current?.goBack()}
            style={[styles.navBtn, !canGoBack && styles.disabledBtn]}
          >
            <Feather name="chevron-left" size={20} color={canGoBack ? '#00e5ff' : '#475569'} />
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!canGoForward}
            onPress={() => webViewRef.current?.goForward()}
            style={[styles.navBtn, !canGoForward && styles.disabledBtn]}
          >
            <Feather name="chevron-right" size={20} color={canGoForward ? '#00e5ff' : '#475569'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => webViewRef.current?.reload()} style={styles.navBtn}>
            <Feather name="rotate-cw" size={16} color="#00e5ff" />
          </TouchableOpacity>
        </View>

        {/* URL Address Bar */}
        <View style={styles.urlInputWrap}>
          <Feather name="shield" size={12} color="#10b981" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.urlInput}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={handleLoadUrl}
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus
          />
          <TouchableOpacity onPress={toggleBookmark} style={{ paddingLeft: 6 }}>
            <Feather name="bookmark" size={14} color={isBookmarked ? '#00e5ff' : '#64748b'} />
          </TouchableOpacity>
        </View>

        {/* DNS Status Badge */}
        <TouchableOpacity style={styles.dnsPill} onPress={onToggleDNS}>
          <View style={[styles.dnsDot, { backgroundColor: useCloudflareDNS ? '#10b981' : '#f59e0b' }]} />
          <Text style={styles.dnsText}>
            {useCloudflareDNS ? `1.1.1.1 ${dnsPing > 0 ? `${dnsPing}ms` : ''}` : 'Standard'}
          </Text>
        </TouchableOpacity>

        {/* Bookmarks Button */}
        <TouchableOpacity style={styles.bookmarkListBtn} onPress={() => setBookmarksModalVisible(true)}>
          <Feather name="list" size={18} color="#00e5ff" />
        </TouchableOpacity>
      </View>

      {/* Quick Shortcuts Bar */}
      <View style={styles.quickBar}>
        {QUICK_LINKS.map((link, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.quickLinkItem}
            onPress={() => setCurrentUrl(link.url)}
          >
            <Feather name={link.icon} size={12} color="#00e5ff" style={{ marginRight: 4 }} />
            <Text style={styles.quickLinkText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* WebView Loading Indicator */}
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#00e5ff" />
        </View>
      )}

      {/* Main WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        onNavigationStateChange={handleNavigationStateChange}
        injectedJavaScript={useCloudflareDNS ? INJECTED_DNS_SCRIPT : undefined}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
        style={styles.webview}
        allowsBackForwardNavigationGestures
        domStorageEnabled
        javaScriptEnabled
      />

      {/* Dynamic Floating Action Button for Chapter Translation */}
      {isChapterPage && (
        <Animated.View style={[styles.fabWrapper, { transform: [{ scale: fabPulse }] }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.fabTranslateBtn}
            onPress={() => onTriggerDownload(currentUrl, `Chap_${extractChapInfo(currentUrl)}`)}
          >
            <Feather name="zap" size={20} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.fabBtnText}>DỊCH CHAPTER NÀY</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bookmarks Modal */}
      <Modal visible={bookmarksModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>BOOKMARKS DẤU TRANG</Text>
              <TouchableOpacity onPress={() => setBookmarksModalVisible(false)}>
                <Feather name="x" size={20} color="#f43f5e" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={bookmarks}
              keyExtractor={(item, idx) => idx.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bookmarkItem}
                  onPress={() => {
                    setCurrentUrl(item.url);
                    setBookmarksModalVisible(false);
                  }}
                >
                  <Feather name="bookmark" size={16} color="#00e5ff" style={{ marginRight: 10 }} />
                  <Text style={styles.bookmarkText} numberOfLines={1}>{item.title}</Text>
                  <Feather name="chevron-right" size={16} color="#64748b" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.2)',
  },
  navControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginRight: 6,
  },
  navBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  disabledBtn: {
    opacity: 0.3,
  },
  urlInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    marginRight: 6,
  },
  urlInput: {
    flex: 1,
    color: '#00e5ff',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 0,
  },
  dnsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    marginRight: 4,
  },
  dnsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  dnsText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bookmarkListBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  quickBar: {
    flexDirection: 'row',
    backgroundColor: '#0a0c10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  quickLinkText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingBar: {
    height: 2,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: '#050505',
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 9999,
  },
  fabTranslateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00e5ff',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  fabBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
    borderTopWidth: 1,
    borderTopColor: '#00e5ff',
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
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  bookmarkText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
});
