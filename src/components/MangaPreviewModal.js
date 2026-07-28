import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, Modal, TouchableOpacity, FlatList, Image,
  Dimensions, StatusBar, Platform, SafeAreaView
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
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
              <View style={styles.readerHint}>
                <Feather name="chevrons-down" size={14} color="#00e5ff" />
                <Text style={styles.fullPageCounter}>Kéo xuống để đọc • {images.length} trang</Text>
              </View>
              </LinearGradient>

              <FlatList
                data={images}
                style={styles.readerList}
                initialScrollIndex={selectedIndex}
                keyExtractor={(item, index) => `${item}-${index}`}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.readerContent}
                getItemLayout={(_, index) => ({
                  length: height - 100,
                  offset: (height - 100) * index,
                  index,
                })}
                renderItem={({ item, index }) => (
                  <View style={styles.readerPage}>
                    <Image source={{ uri: item }} style={styles.readerImage} resizeMode="contain" />
                    <View style={styles.readerPageBadge}>
                      <Text style={styles.readerPageText}>{index + 1} / {images.length}</Text>
                    </View>
                  </View>
                )}
              />

              {/* Bottom Reading Mode HUD Bar */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.95)']}
                style={styles.fullScreenBottomBar}
              >
                <View style={styles.readerBottomBadge}>
                  <Feather name="book-open" size={13} color="#00e5ff" style={{ marginRight: 6 }} />
                  <Text style={styles.readerBottomText}>CHẾ ĐỘ ĐỌC NÉT CAO VIP • {images.length} TRANG</Text>
                </View>
              </LinearGradient>
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
    backgroundColor: '#030712',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(11, 15, 25, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 240, 255, 0.25)',
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
  },
  backBtnText: {
    color: '#00f0ff',
    fontWeight: '800',
    fontSize: 13,
  },
  titleWrapper: {
    flex: 1,
    marginHorizontal: 12,
  },
  chapTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '900',
  },
  chapSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 240, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#00f0ff',
  },
  exportText: {
    color: '#00f0ff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  gridContainer: {
    padding: 14,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 1.42,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  pageBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(11, 15, 25, 0.9)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
  },
  pageBadgeText: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '900',
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
    height: 95,
    paddingTop: Platform.OS === 'ios' ? 46 : 22,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  closeFullBtn: {
    padding: 9,
    borderRadius: 22,
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  fullPageCounter: {
    color: '#00f0ff',
    fontWeight: '900',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fullImage: {
    width: width,
    height: '100%',
  },
  readerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readerContent: {
    paddingTop: 84,
    paddingBottom: 28,
  },
  readerList: {
    flex: 1,
    width: '100%',
  },
  readerPage: {
    width,
    height: height - 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    marginBottom: 10,
  },
  readerImage: {
    width,
    height: height - 116,
  },
  readerPageBadge: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  readerPageText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fullScreenNavControls: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  navArrowBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(11, 15, 25, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00f0ff',
  },
  disabledNavBtn: {
    opacity: 0.25,
  },
  fullScreenBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  readerBottomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(3, 7, 18, 0.86)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
  },
  readerBottomText: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
