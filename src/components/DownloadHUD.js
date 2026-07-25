import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Animated, Easing, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Enhanced Cyberpunk Glassmorphic Floating Download HUD
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
  const slideAnim = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }).start();

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
  let statusBadge = 'NEXUS ENGINE • VIP BATCH PROCESSOR';
  if (isComplete) {
    dotColor = '#10b981';
    statusBadge = 'NEXUS ENGINE • XỬ LÝ HOÀN TẤT';
  } else if (isError) {
    dotColor = '#ef4444';
    statusBadge = 'NEXUS ENGINE • GẶP LỖI';
  }

  // Minimized Compact Floating Mode
  if (minimized) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
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

  return (
    <Animated.View style={[styles.hudContainer, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.hudCard}>
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

        {/* Counter Row */}
        <View style={styles.counterRow}>
          <Text style={styles.counterText}>
            {isComplete ? 'Đã tải & dịch 100%' : 'Tiến độ dịch: '}
            <Text style={{ color: '#00e5ff', fontWeight: '900' }}>{percentInt}%</Text>
          </Text>
          {chapTitle ? <Text style={styles.chapBadge}>{chapTitle}</Text> : null}
        </View>

        {/* Multi-Color Glossy Gradient Progress Bar */}
        <View style={styles.barBg}>
          <LinearGradient
            colors={isError ? ['#ef4444', '#b91c1c'] : ['#00e5ff', '#a855f7', '#ec4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barFill, { width: `${Math.max(5, percentInt)}%` }]}
          />
        </View>

        {/* Real-time Status Detail */}
        <Text style={styles.statusDetailText} numberOfLines={2}>
          {statusText || 'Đang kết nối tới Nexus Translator Engine...'}
        </Text>

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
                <Feather name="hard-drive" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>XEM THƯ VIỆN CHAPTER</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.toolBtn} onPress={() => setMinimized(true)}>
                <Feather name="arrow-down-left" size={14} color="#00e5ff" style={{ marginRight: 4 }} />
                <Text style={styles.toolBtnText}>Thu Nhỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toolBtn, styles.cancelBtn]} onPress={onCancel}>
                <Feather name="stop-circle" size={14} color="#f43f5e" style={{ marginRight: 4 }} />
                <Text style={[styles.toolBtnText, { color: '#f43f5e' }]}>Dừng / Hủy</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hudContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 14,
    right: 14,
    zIndex: 99999,
  },
  hudCard: {
    backgroundColor: 'rgba(10, 12, 16, 0.95)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hudStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  hudTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  chapBadge: {
    color: '#00e5ff',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  barBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  statusDetailText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 10,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  cancelBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderColor: 'rgba(244, 63, 94, 0.2)',
  },
  toolBtnText: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryActionBtn: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  minimizedPill: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 24,
    right: 15,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 12, 16, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00e5ff',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
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
