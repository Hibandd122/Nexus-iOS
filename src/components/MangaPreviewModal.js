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
  readerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  readerContent: {
    paddingTop: 78,
    paddingBottom: 24,
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
    marginBottom: 8,
  },
  readerImage: {
    width,
    height: height - 116,
  },
  readerPageBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 14, 22, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  readerPageText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
