import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Player } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import { getWikimediaImageUrl } from '../../data/playerRepository';
import { PLAYER_IMAGES } from '../../data/playerImages';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface BlurredPlayerPhotoProps {
  player: Player;
  blurAmount: number;
  revealed: boolean;
  attemptLabel: string;
  onSwitchFallbackPlayer?: () => void;
}

export function BlurredPlayerPhoto({
  player,
  blurAmount,
  revealed,
  attemptLabel,
  onSwitchFallbackPlayer,
}: BlurredPlayerPhotoProps) {
  const { tokens } = useTheme();
  const [retryCount, setRetryCount] = useState(0);
  const [imgError, setImgError] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const bundledAsset: ImageSourcePropType | undefined = PLAYER_IMAGES[player.id];
  const fallbackRemoteUrl = getWikimediaImageUrl(player.imageFile, 480);

  // Prefer bundled local asset (works offline & avoids Android OkHttp 403 on Wikimedia)
  const imageSource: ImageSourcePropType =
    bundledAsset ?? {
      uri: retryCount > 0 ? `${fallbackRemoteUrl}&r=${retryCount}` : fallbackRemoteUrl,
    };

  useEffect(() => {
    setRetryCount(0);
    setImgError(false);
  }, [player.id]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 0.96,
        duration: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(pulseAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [blurAmount, pulseAnim]);

  const handleImageError = (errMsg?: string) => {
    if (__DEV__) {
      console.warn(
        `[WhoAreYaImage] Failed to load image for ${player.id} (retry=${retryCount}): ${errMsg ?? 'unknown error'}`
      );
    }
    // Automatic one-time retry before showing fallback UI
    if (retryCount === 0) {
      setRetryCount(1);
    } else {
      setImgError(true);
    }
  };

  const handleManualRetry = () => {
    setImgError(false);
    setRetryCount((c) => c + 1);
  };

  const webBlurStyle =
    Platform.OS === 'web'
      ? ({
          filter: `blur(${blurAmount}px)`,
          transition: 'filter 380ms ease-out',
          transform: blurAmount > 0 ? 'scale(1.12)' : 'scale(1)',
        } as unknown as object)
      : undefined;

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <View style={styles.topBar}>
        <Text style={[styles.badge, { color: tokens.accent }]}>{attemptLabel}</Text>
        <Text style={[styles.blurLabel, { color: tokens.textMuted }]}>
          {revealed ? 'Net Görünüm' : `Bulanıklık: %${Math.round((blurAmount / 26) * 100)}`}
        </Text>
      </View>

      <Animated.View
        style={[
          styles.frame,
          {
            backgroundColor: tokens.surfaceElevated,
            borderColor: revealed ? tokens.success : tokens.accent,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {!imgError ? (
          <Image
            key={`${player.id}-${retryCount}`}
            source={imageSource}
            style={[styles.image, webBlurStyle]}
            blurRadius={Platform.OS === 'web' ? 0 : blurAmount}
            resizeMode="cover"
            onLoad={() => {
              if (__DEV__) {
                console.log(
                  `[WhoAreYaImage] Loaded ${bundledAsset ? 'bundled asset' : 'remote URL'} for ${player.id}`
                );
              }
            }}
            onError={(e) => handleImageError(e.nativeEvent?.error)}
          />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="person-circle-outline" size={64} color={tokens.textMuted} />
            <Text style={[styles.fallbackTitle, { color: tokens.text }]}>
              {revealed ? player.name : 'Fotoğraf yüklenemedi'}
            </Text>
            {!revealed && (
              <View style={styles.fallbackActions}>
                <Pressable
                  onPress={handleManualRetry}
                  style={[styles.fallbackBtn, { backgroundColor: tokens.accent }]}
                >
                  <Ionicons name="refresh" size={14} color={tokens.accentText} />
                  <Text style={[styles.fallbackBtnText, { color: tokens.accentText }]}>
                    Yeniden Dene
                  </Text>
                </Pressable>
                {onSwitchFallbackPlayer ? (
                  <Pressable
                    onPress={onSwitchFallbackPlayer}
                    style={[
                      styles.fallbackBtn,
                      { backgroundColor: tokens.surface, borderColor: tokens.border, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.fallbackBtnText, { color: tokens.text }]}>
                      Başka Oyuncu Seç
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        )}

        {revealed && (
          <View style={[styles.revealBanner, { backgroundColor: tokens.accent }]}>
            <Text style={[styles.revealName, { color: tokens.accentText }]}>{player.name}</Text>
            <Text style={[styles.revealMeta, { color: tokens.accentText }]}>
              {player.nationality} • {player.position} • {player.birthYear}
            </Text>
          </View>
        )}
      </Animated.View>

      {revealed ? (
        <Text style={[styles.attribution, { color: tokens.textMuted }]} numberOfLines={2}>
          Görsel: {player.imageAttribution} ({player.imageLicense})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    fontSize: 13,
    fontWeight: '800',
  },
  blurLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  frame: {
    width: 240,
    height: 260,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
  },
  fallbackTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  fallbackActions: {
    gap: 6,
    width: '100%',
    alignItems: 'center',
  },
  fallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  fallbackBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  revealBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  revealName: {
    fontSize: 15,
    fontWeight: '900',
  },
  revealMeta: {
    fontSize: 11.5,
    opacity: 0.92,
  },
  attribution: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
});
