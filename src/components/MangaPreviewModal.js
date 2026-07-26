import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, Modal, TouchableOpacity, FlatList, Image,
  Dimensions, StatusBar, Platform, SafeAreaView
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const THUMB_SIZE = (width - 48) / 3; // 3 columns grid

/**
 * Ultra VIP Manga Chapter Previewer & Gallery Grid Component
 */
export default function MangaPreviewModal({ visible, chapId, onClose, onExportCBZ }) {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (visible && chapId) {
      loadChapterImages(chapId);
    } else {
      setImages([]);
      setSelectedImage(null);
    }
  }, [visible, chapId]);

  const getChapDir = () => FileSystem.documentDirectory + 'manga_chapters/';

  const isImageFile = (name) => /\.(jpe?g|png|webp|gif|avif)$/i.test(name);

  const findImageUris = async (directoryUri) => {
    const entries = await FileSystem.readDirectoryAsync(directoryUri);
    const imageUris = [];

    for (const entry of entries) {
      const entryUri = directoryUri + entry;
      const info = await FileSystem.getInfoAsync(entryUri);
      if (info.isDirectory) {
        imageUris.push(...await findImageUris(`${entryUri}/`));
      } else if (isImageFile(entry)) {
        imageUris.push(entryUri);
      }
    }

    return imageUris;
  };

  const loadChapterImages = async (folderName) => {
    try {
      const dirPath = getChapDir() + folderName + '/';
      const fullUris = await findImageUris(dirPath);
      fullUris.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      setImages(fullUris);
    } catch (e) {
      console.log('Error loading preview images:', e);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#050505" />

        {/* Top Header Controls */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Feather name="chevron-left" size={24} color="#00e5ff" />
            <Text style={styles.backBtnText}>Thư Viện</Text>
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={styles.chapTitle} numberOfLines={1}>{chapId}</Text>
            <Text style={styles.chapSub}>{images.length} Trang Ảnh • Nexus Preview</Text>
          </View>

          {onExportCBZ ? (
            <TouchableOpacity style={styles.exportBtn} onPress={() => onExportCBZ(chapId)}>
              <Feather name="share" size={16} color="#00e5ff" style={{ marginRight: 4 }} />
              <Text style={styles.exportText}>CBZ</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Thumbnail Grid Gallery */}
        <FlatList
          data={images}
          numColumns={3}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.thumbWrapper}
              onPress={() => {
                setSelectedImage(item);
                setSelectedIndex(index);
              }}
            >
              <Image source={{ uri: item }} style={styles.thumbImage} resizeMode="cover" />
              <View style={styles.pageBadge}>
                <Text style={styles.pageBadgeText}>#{index + 1}</Text>
              </View>
            </TouchableOpacity>
          )}
        />

        {/* Fullscreen High-Res Image Previewer Overlay */}
        {selectedImage && (
          <Modal visible={!!selectedImage} transparent animationType="fade">
            <View style={styles.fullScreenPreviewOverlay}>
              <StatusBar hidden />
              
              {/* Top Bar Overlay */}
              <LinearGradient
                colors={['rgba(0,0,0,0.9)', 'transparent']}
                style={styles.fullScreenTopBar}
              >
                <TouchableOpacity style={styles.closeFullBtn} onPress={() => setSelectedImage(null)}>
                  <Feather name="x" size={24} color="#00e5ff" />
                </TouchableOpacity>
                <Text style={styles.fullPageCounter}>
                  Trang {selectedIndex + 1} / {images.length}
                </Text>
              </LinearGradient>

              {/* Full Image */}
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullImage}
                resizeMode="contain"
              />

              {/* Navigation Controls Overlay */}
              <View style={styles.fullScreenNavControls}>
                <TouchableOpacity
                  disabled={selectedIndex <= 0}
                  style={[styles.navArrowBtn, selectedIndex <= 0 && styles.disabledNavBtn]}
                  onPress={() => {
                    if (selectedIndex > 0) {
                      setSelectedIndex(selectedIndex - 1);
                      setSelectedImage(images[selectedIndex - 1]);
                    }
                  }}
                >
                  <Feather name="chevron-left" size={28} color="#00e5ff" />
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={selectedIndex >= images.length - 1}
                  style={[styles.navArrowBtn, selectedIndex >= images.length - 1 && styles.disabledNavBtn]}
                  onPress={() => {
                    if (selectedIndex < images.length - 1) {
                      setSelectedIndex(selectedIndex + 1);
                      setSelectedImage(images[selectedIndex + 1]);
                    }
                  }}
                >
                  <Feather name="chevron-right" size={28} color="#00e5ff" />
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0a0c10',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.2)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  backBtnText: {
    color: '#00e5ff',
    fontWeight: '700',
    fontSize: 13,
  },
  titleWrapper: {
    flex: 1,
    marginHorizontal: 10,
  },
  chapTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  chapSub: {
    color: '#64748b',
    fontSize: 11,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00e5ff',
  },
  exportText: {
    color: '#00e5ff',
    fontWeight: '900',
    fontSize: 12,
  },
  gridContainer: {
    padding: 12,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 1.4,
    margin: 4,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  pageBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(10, 14, 22, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  pageBadgeText: {
    color: '#00e5ff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fullScreenPreviewOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  closeFullBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 14, 22, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  fullPageCounter: {
    color: '#00e5ff',
    fontWeight: '900',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fullImage: {
    width: width,
    height: '100%',
  },
  fullScreenNavControls: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  navArrowBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10, 14, 22, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00e5ff',
  },
  disabledNavBtn: {
    opacity: 0.2,
  },
});
