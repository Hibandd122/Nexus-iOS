import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Animated, Easing, Platform, Modal, Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

/**
 * VIP Full-Screen Hover Overlay Download HUD
 */
export default function DownloadHUD({
  visible,
  statusText,
  progress, // 0 to 1
  isComplete,
  isError,
  onCancel,
  onOpenLibrary,
  chapTitle,
}) {
  const [minimized, setMinimized] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hoverAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Continuous floating hover animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(hoverAnim, {
            toValue: -8,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(hoverAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Pulsing status dot animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      setMinimized(false);
    }
  }, [visible]);

  if (!visible) return null;

  const percentInt = Math.round(progress * 100);

  let dotColor = '#00e5ff';
  let statusBadge = 'NEXUS VIP • ENGINE ĐANG DỊCH';
  if (isComplete) {
    dotColor = '#10b981';
    statusBadge = 'NEXUS VIP • HOÀN TẤT 100%';
  } else if (isError) {
    dotColor = '#ef4444';
    statusBadge = 'NEXUS VIP • GẶP LỖI';
  }

  // Minimized Compact Floating Mode
  if (minimized) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setMinimized(false)}
        style={styles.minimizedPill}
      >
        <Animated.View
          style={[styles.minDot, { backgroundColor: dotColor, opacity: isComplete || isError ? 1 : pulseAnim }]}
        />
        <Feather name="zap" size={14} color="#00e5ff" style={{ marginRight: 4 }} />
        <Text style={styles.minText}>
          {isComplete ? '100% XONG' : `${percentInt}% • ${chapTitle || 'Chapter'}`}
        </Text>
        <Feather name="maximize-2" size={12} color="#94a3b8" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    );
  }

  // Full-Screen Hover Modal Overlay
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.fullScreenOverlay}>
        <Animated.View style={[styles.hoverCardContainer, { transform: [{ translateY: hoverAnim }] }]}>
          <View style={styles.vipHudCard}>
            {/* Top Glow Accent Bar */}
            <LinearGradient
              colors={['#00e5ff', '#a855f7', '#ec4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topAccentBar}
            />

            {/* Header Row */}
            <View style={styles.hudHeader}>
              <View style={styles.hudStatusGroup}>
                <Animated.View
                  style={[
                    styles.statusDot,
                    { backgroundColor: dotColor, opacity: isComplete || isError ? 1 : pulseAnim },
                  ]}
                />
                <Text style={styles.hudTitle}>{statusBadge}</Text>
              </View>

              <View style={styles.headerRightActions}>
                <TouchableOpacity onPress={() => setMinimized(true)} style={styles.iconBtn}>
                  <Feather name="minimize-2" size={16} color="#94a3b8" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onCancel} style={styles.iconBtn}>
                  <Feather name="x" size={16} color="#f43f5e" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Chapter Title Badge & Counter */}
            <View style={styles.counterRow}>
              <Text style={styles.counterText}>
                {isComplete ? 'Đã tải & nén thành công!' : 'Tiến độ xử lý AI: '}
                <Text style={styles.percentNumber}>{percentInt}%</Text>
              </Text>
              {chapTitle ? <Text style={styles.chapBadge}>{chapTitle}</Text> : null}
            </View>

            {/* Animated Shimmer Progress Bar */}
            <View style={styles.barBg}>
              <LinearGradient
                colors={isError ? ['#ef4444', '#b91c1c'] : ['#00e5ff', '#a855f7', '#ec4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.barFill, { width: `${Math.max(6, percentInt)}%` }]}
              />
            </View>

            {/* Detailed Real-time Status Message */}
            <View style={styles.statusBox}>
              <Feather name="activity" size={14} color="#00e5ff" style={{ marginRight: 6 }} />
              <Text style={styles.statusDetailText} numberOfLines={2}>
                {statusText || 'Đang thiết lập tiến trình dịch thuật tự động...'}
              </Text>
            </View>

            {/* Action Toolbar */}
            <View style={styles.toolbar}>
              {isComplete ? (
                <TouchableOpacity style={styles.primaryActionBtn} onPress={onOpenLibrary}>
                  <LinearGradient
                    colors={['#00e5ff', '#0097a7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBtn}
                  >
                    <Feather name="hard-drive" size={18} color="#000" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>MỞ THƯ VIỆN CHAPTER</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.toolBtn} onPress={() => setMinimized(true)}>
                    <Feather name="arrow-down-left" size={14} color="#00e5ff" style={{ marginRight: 6 }} />
                    <Text style={styles.toolBtnText}>Thu Nhỏ Bar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.toolBtn, styles.cancelBtn]} onPress={onCancel}>
                    <Feather name="stop-circle" size={14} color="#f43f5e" style={{ marginRight: 6 }} />
                    <Text style={[styles.toolBtnText, { color: '#f43f5e' }]}>Hủy Tiến Trình</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  hoverCardContainer: {
    width: '100%',
    maxWidth: 420,
  },
  vipHudCard: {
    backgroundColor: 'rgba(10, 14, 22, 0.95)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
  },
  topAccentBar: {
    height: 3,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  hudStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 8,
  },
  hudTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00e5ff',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  percentNumber: {
    color: '#00e5ff',
    fontWeight: '900',
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chapBadge: {
    color: '#ec4899',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  barBg: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  statusDetailText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  cancelBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  toolBtnText: {
    color: '#00e5ff',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryActionBtn: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  minimizedPill: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 24,
    right: 15,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 22, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00e5ff',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  minDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  minText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
