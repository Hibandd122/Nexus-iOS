import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, Image,
  ActivityIndicator, Alert, ScrollView, Platform, Animated
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { dohFetch } from '../utils/dns';

/**
 * TikTok / Douyin Downloader Component
 */
export default function TikTokDownloader({ backendUrl }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [previewData, setPreviewData] = useState(null);

  const handleFetchInfo = async () => {
    if (!url.trim()) {
      Alert.alert("TikTok DL", "Vui lòng nhập hoặc dán liên kết TikTok / Douyin.");
      return;
    }

    setLoading(true);
    setPreviewData(null);
    setDownloadStatus('Đang phân tích liên kết TikTok...');

    try {
      const formData = new FormData();
      formData.append("action", "download");
      formData.append("url", url.trim());

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

  const handleDownloadFile = async (fileUrl, fileType, defaultFilename) => {
    if (!fileUrl) {
      Alert.alert("Lỗi", "Không tìm thấy đường dẫn tải về.");
      return;
    }

    setDownloadingMedia(true);
    setDownloadStatus(`Đang tải ${fileType}...`);

    try {
      const extension = fileType === 'video' ? 'mp4' : (fileType === 'audio' ? 'mp3' : 'jpg');
      const filename = `tiktok_${Date.now()}.${extension}`;
      const targetUri = FileSystem.documentDirectory + filename;

      const downloadRes = await FileSystem.downloadAsync(fileUrl, targetUri);

      if (downloadRes.status !== 200) {
        throw new Error(`HTTP ${downloadRes.status}`);
      }

      setDownloadStatus('Tải thành công! Đang mở menu chia sẻ...');

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
        <View style={styles.panelHeaderRow}>
          <Text style={styles.panelTitle}>TIKTOK / DOUYIN DOWNLOADER</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>HD NO WATERMARK</Text>
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Dán link TikTok (vd: https://vt.tiktok.com/...)"
          placeholderTextColor="#475569"
          value={url}
          onChangeText={setUrl}
          editable={!loading}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity onPress={handleFetchInfo} disabled={loading || !url.trim()}>
          <LinearGradient
            colors={loading ? ['#334155', '#1e293b'] : ['#ec4899', '#8b5cf6']}
            style={styles.btn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />
            ) : (
              <Feather name="search" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.btnText}>{loading ? 'ĐANG PHÂN TÍCH...' : 'LẤY LINK TẢI'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {downloadStatus ? (
          <Text style={styles.statusText}>{downloadStatus}</Text>
        ) : null}
      </View>

      {/* Preview Card */}
      {previewData && (
        <View style={styles.previewCard}>
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
              <Text style={styles.sourcePlatform}>{previewData.source_platform || 'TikTok'}</Text>
            </View>
          </View>

          {previewData.desc ? (
            <Text style={styles.descText}>{previewData.desc}</Text>
          ) : null}

          {/* Action Download Buttons */}
          <View style={styles.actionButtonsCol}>
            {/* Download Video Button */}
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
                  <Feather name="video" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>TẢI VIDEO KHÔNG LOGO (MP4)</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Download Audio Button */}
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
                  <Text style={styles.actionBtnText}>TẢI NHẠC NỀN / MP3</Text>
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
          Hỗ trợ tải video TikTok, Douyin không dính watermark, tải nhạc MP3 chất lượng cao trực tiếp về máy.
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.2)',
    marginBottom: 16,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badge: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.4)',
  },
  badgeText: {
    color: '#ec4899',
    fontSize: 9,
    fontWeight: '800',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#ec4899',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    marginBottom: 14,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  btn: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  statusText: {
    marginTop: 10,
    color: '#ec4899',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  sourcePlatform: {
    color: '#94a3b8',
    fontSize: 11,
  },
  descText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  actionButtonsCol: {
    gap: 10,
  },
  downloadActionBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.05)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.15)',
    marginBottom: 40,
  },
  infoText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
});
