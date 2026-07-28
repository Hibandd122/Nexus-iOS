import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, Image,
  ActivityIndicator, Alert, ScrollView, Platform, Animated
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { dohFetch } from '../utils/dns';

/**
 * ArrayBuffer to Base64 Converter
 */
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return global.btoa ? global.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Extracts a valid HTTP/HTTPS URL from raw Douyin/TikTok share text
 */
export function extractUrlFromText(text) {
  if (!text) return '';
  const match = text.match(/https?:\/\/[^\s\u4e00-\u9fa5]+/i) || text.match(/https?:\/\/[^\s]+/i);
  if (match) {
    let extracted = match[0].trim();
    extracted = extracted.replace(/[\u4e00-\u9fa5！!，,。?？]+.*$/, '');
    return extracted;
  }
  return text.trim();
}

/**
 * Ultra VIP TikTok / Douyin Downloader Component
 */
export default function TikTokDownloader({ backendUrl }) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [previewData, setPreviewData] = useState(null);

  const handleFetchInfo = async () => {
    const targetUrl = extractUrlFromText(inputText);
    if (!targetUrl) {
      Alert.alert("TikTok DL VIP", "Vui lòng nhập văn bản chứa liên kết TikTok / Douyin.");
      return;
    }

    setLoading(true);
    setPreviewData(null);
    setDownloadStatus(`Đang phân tích liên kết: ${targetUrl.substring(0, 30)}...`);

    try {
      const formData = new FormData();
      formData.append("action", "download");
      formData.append("url", targetUrl);

      const res = await dohFetch(`${backendUrl}/tiktok-downloader`, {
        method: "POST",
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setPreviewData(data);
      setDownloadStatus('');
    } catch (error) {
      Alert.alert("Lỗi TikTok DL", error.message || "Không thể phân tích video này.");
      setDownloadStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setPreviewData(null);
    setDownloadStatus('');
  };

  const handleDownloadFile = async (fileUrl, fileType) => {
    if (!fileUrl) {
      Alert.alert("Lỗi", "Không tìm thấy đường dẫn tải về.");
      return;
    }

    setDownloadingMedia(true);
    setDownloadStatus(`Đang tải tệp ${fileType.toUpperCase()}...`);

    try {
      const extension = fileType === 'video' ? 'mp4' : (fileType === 'audio' ? 'mp3' : 'jpg');
      const filename = `tiktok_${Date.now()}.${extension}`;
      const targetUri = FileSystem.documentDirectory + filename;

      const downloadRes = await dohFetch(fileUrl);
      if (!downloadRes.ok) {
        throw new Error(`HTTP ${downloadRes.status}`);
      }

      const arrayBuf = await downloadRes.arrayBuffer();
      const base64Data = arrayBufferToBase64(arrayBuf);
      await FileSystem.writeAsStringAsync(targetUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });

      setDownloadStatus('Tải hoàn tất! Đang mở menu chia sẻ...');

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(targetUri);
      } else {
        Alert.alert("Thành công", `Đã lưu tệp vào: ${targetUri}`);
      }
    } catch (e) {
      Alert.alert("Lỗi tải tệp", e.message || "Tải media thất bại.");
    } finally {
      setDownloadingMedia(false);
      setDownloadStatus('');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Input Glass Panel */}
      <View style={styles.glassPanel}>
        <LinearGradient
          colors={['#ec4899', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topGradientBar}
        />

        <View style={styles.panelHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="video" size={16} color="#ec4899" style={{ marginRight: 6 }} />
            <Text style={styles.panelTitle}>TIKTOK & DOUYIN VIP DOWNLOADER</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>AUTO EXTRACT LINK</Text>
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Dán toàn bộ văn bản chia sẻ Douyin/TikTok..."
            placeholderTextColor="#475569"
            value={inputText}
            onChangeText={setInputText}
            editable={!loading}
            multiline
            numberOfLines={3}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {inputText ? (
            <TouchableOpacity style={styles.clearInputBtn} onPress={handleClear}>
              <Feather name="x-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {!inputText ? (
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={styles.chipBtn}
              onPress={() => setInputText('7.11 02/09 H4.60 H:/ 复制打开抖音，看看【NEXUS VIP】 https://v.douyin.com/iL2y3X/')}
            >
              <Feather name="copy" size={11} color="#ec4899" style={{ marginRight: 4 }} />
              <Text style={styles.chipBtnText}>Thử Link Douyin Mẫu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chipBtn}
              onPress={() => setInputText('Check out this video on TikTok https://vt.tiktok.com/ZSjX1234/')}
            >
              <Feather name="copy" size={11} color="#ec4899" style={{ marginRight: 4 }} />
              <Text style={styles.chipBtnText}>Thử Link TikTok Mẫu</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity onPress={handleFetchInfo} disabled={loading || !inputText.trim()}>
          <LinearGradient
            colors={loading ? ['#334155', '#1e293b'] : ['#ec4899', '#8b5cf6']}
            style={styles.btn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />
            ) : (
              <Feather name="zap" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.btnText}>{loading ? 'ĐANG TÁCH LINK & PHÂN TÍCH...' : '⚡ PHÂN TÍCH & TẢI MEDIA'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {downloadStatus ? (
          <Text style={styles.statusText}>{downloadStatus}</Text>
        ) : null}
      </View>

      {/* Preview Card */}
      {previewData && (
        <View style={styles.previewCard}>
          <LinearGradient
            colors={['rgba(236, 72, 153, 0.2)', 'transparent']}
            style={styles.previewGradientHeader}
          />

          <View style={styles.authorRow}>
            {previewData.avatar ? (
              <Image source={{ uri: previewData.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Feather name="user" size={20} color="#ec4899" />
              </View>
            )}
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>@{previewData.author || 'tiktok_user'}</Text>
              <Text style={styles.sourcePlatform}>{previewData.source_platform || 'TikTok / Douyin VIP'}</Text>
            </View>

            <View style={styles.hdTag}>
              <Text style={styles.hdTagText}>FULL HD</Text>
            </View>
          </View>

          {previewData.desc ? (
            <Text style={styles.descText}>{previewData.desc}</Text>
          ) : null}

          {/* Download Action Buttons */}
          <View style={styles.actionButtonsCol}>
            {previewData.download_url && (
              <TouchableOpacity
                disabled={downloadingMedia}
                style={styles.downloadActionBtn}
                onPress={() => handleDownloadFile(previewData.download_url, 'video')}
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={styles.actionGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Feather name="download" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>TẢI VIDEO KHÔNG LOGO (MP4)</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {previewData.audio_url && (
              <TouchableOpacity
                disabled={downloadingMedia}
                style={styles.downloadActionBtn}
                onPress={() => handleDownloadFile(previewData.audio_url, 'audio')}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#6d28d9']}
                  style={styles.actionGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Feather name="music" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>TẢI NHẠC NỀN AUDIO (MP3)</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoBox}>
        <Feather name="shield" size={16} color="#ec4899" style={{ marginRight: 8 }} />
        <Text style={styles.infoText}>
          Công nghệ tự động nhận diện & tách liên kết `https://v.douyin.com/...` từ bất kỳ văn bản chia sẻ nào.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  glassPanel: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.4)',
    marginBottom: 16,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  topGradientBar: {
    height: 3.5,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  panelTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  badge: {
    backgroundColor: 'rgba(236, 72, 153, 0.18)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.45)',
  },
  badgeText: {
    color: '#ec4899',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    color: '#ec4899',
    padding: 15,
    paddingRight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.35)',
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  clearInputBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  btn: {
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  statusText: {
    marginTop: 12,
    color: '#ec4899',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.45)',
    marginBottom: 16,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 12,
    overflow: 'hidden',
  },
  previewGradientHeader: {
    height: 44,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#ec4899',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(236, 72, 153, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.35)',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  sourcePlatform: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  hdTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  hdTagText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  descText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  actionButtonsCol: {
    gap: 12,
  },
  downloadActionBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
    marginBottom: 40,
  },
  infoText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 19,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  chipBtnText: {
    color: '#ec4899',
    fontSize: 11,
    fontWeight: '800',
  },
});
