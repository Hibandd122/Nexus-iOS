import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable, Animated, Easing, Platform, Modal, Dimensions
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
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Continuous floating hover animation
      const floatLoop = Animated.loop(
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
      );
      floatLoop.start();

      // Pulsing status dot animation
      const pulseLoop = Animated.loop(
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
      );
      pulseLoop.start();

      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, damping: 14, stiffness: 180, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();

      return () => {
        floatLoop.stop();
        pulseLoop.stop();
        cardScale.stopAnimation();
        cardOpacity.stopAnimation();
      };
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
      <Pressable
        onPress={() => setMinimized(false)}
        style={({ pressed, hovered }) => [
          styles.minimizedPill,
          (pressed || hovered) && styles.minimizedPillActive,
        ]}
      >
        <Animated.View
          style={[styles.minDot, { backgroundColor: dotColor, opacity: isComplete || isError ? 1 : pulseAnim }]}
        />
        <Feather name="zap" size={14} color="#00e5ff" style={{ marginRight: 4 }} />
        <Text style={styles.minText}>
          {isComplete ? '100% XONG' : `${percentInt}% • ${chapTitle || 'Chapter'}`}
        </Text>
        <Feather name="maximize-2" size={12} color="#94a3b8" style={{ marginLeft: 6 }} />
      </Pressable>
    );
  }

  // Full-Screen Hover Modal Overlay
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.fullScreenOverlay}>
        <Animated.View style={[styles.hoverCardContainer, { opacity: cardOpacity, transform: [{ translateY: hoverAnim }, { scale: cardScale }] }]}>
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
                <Pressable
                  onPress={() => setMinimized(true)}
                  style={({ pressed, hovered }) => [styles.iconBtn, (pressed || hovered) && styles.iconBtnActive]}
                >
                  <Feather name="minimize-2" size={16} color="#94a3b8" />
                </Pressable>
                <Pressable
                  onPress={onCancel}
                  style={({ pressed, hovered }) => [styles.iconBtn, (pressed || hovered) && styles.iconBtnDanger]}
                >
                  <Feather name="x" size={16} color="#f43f5e" />
                </Pressable>
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
                <Pressable
                  style={({ pressed, hovered }) => [styles.primaryActionBtn, (pressed || hovered) && styles.primaryActionBtnActive]}
                  onPress={onOpenLibrary}
                >
                  <LinearGradient
                    colors={['#00e5ff', '#0097a7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBtn}
                  >
                    <Feather name="hard-drive" size={18} color="#000" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>MỞ THƯ VIỆN CHAPTER</Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={({ pressed, hovered }) => [styles.toolBtn, (pressed || hovered) && styles.toolBtnActive]}
                    onPress={() => setMinimized(true)}
                  >
                    <Feather name="arrow-down-left" size={14} color="#00e5ff" style={{ marginRight: 6 }} />
                    <Text style={styles.toolBtnText}>Thu Nhỏ Bar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed, hovered }) => [styles.toolBtn, styles.cancelBtn, (pressed || hovered) && styles.cancelBtnActive]}
                    onPress={onCancel}
                  >
                    <Feather name="stop-circle" size={14} color="#f43f5e" style={{ marginRight: 6 }} />
                    <Text style={[styles.toolBtnText, { color: '#f43f5e' }]}>Hủy Tiến Trình</Text>
                  </Pressable>
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
    backgroundColor: 'rgba(3, 7, 18, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  hoverCardContainer: {
    width: '100%',
    maxWidth: 420,
  },
  vipHudCard: {
    backgroundColor: 'rgba(11, 15, 25, 0.96)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.45)',
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 20,
    overflow: 'hidden',
  },
  topAccentBar: {
    height: 3.5,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 4,
  },
  hudStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  hudTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00f0ff',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.18)',
    borderColor: 'rgba(0, 240, 255, 0.5)',
    transform: [{ scale: 1.06 }],
  },
  iconBtnDanger: {
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    borderColor: 'rgba(244, 63, 94, 0.5)',
    transform: [{ scale: 1.06 }],
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  percentNumber: {
    color: '#00f0ff',
    fontWeight: '900',
    fontSize: 19,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chapBadge: {
    color: '#ec4899',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(236, 72, 153, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.35)',
  },
  barBg: {
    width: '100%',
    height: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    marginBottom: 18,
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
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  toolBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.2)',
    borderColor: 'rgba(0, 240, 255, 0.7)',
    transform: [{ translateY: -1 }],
  },
  cancelBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  cancelBtnActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderColor: 'rgba(244, 63, 94, 0.7)',
    transform: [{ translateY: -1 }],
  },
  toolBtnText: {
    color: '#00f0ff',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryActionBtn: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryActionBtnActive: {
    transform: [{ scale: 1.015 }],
    opacity: 0.94,
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  minimizedPill: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: 16,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 25, 0.96)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#00f0ff',
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  minimizedPillActive: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderColor: '#7cffff',
    transform: [{ scale: 1.04 }],
  },
  minDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  minText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
