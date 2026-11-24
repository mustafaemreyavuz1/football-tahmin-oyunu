import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Player } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import { getWikimediaImageUrl } from '../../data/playerRepository';

interface BlurredPlayerPhotoProps {
  player: Player;
  blurAmount: number;
  revealed: boolean;
  attemptLabel: string;
}

export function BlurredPlayerPhoto({
  player,
  blurAmount,
  revealed,
  attemptLabel,
}: BlurredPlayerPhotoProps) {
  const { tokens } = useTheme();
  const [imgError, setImgError] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const imageUrl = getWikimediaImageUrl(player.imageFile, 480);

  useEffect(() => {
    setImgError(false);
  }, [player.id]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.96, duration: 120, useNativeDriver: true }),
      Animated.spring(pulseAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [blurAmount, pulseAnim]);

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
            source={{ uri: imageUrl }}
            style={[styles.image, webBlurStyle]}
            blurRadius={Platform.OS === 'web' ? 0 : blurAmount}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="person" size={68} color={tokens.textMuted} />
            <Text style={[styles.fallbackTitle, { color: tokens.text }]}>
              {revealed ? player.name : 'Fotoğraf Çevrimdışı'}
            </Text>
            <Text style={[styles.fallbackSub, { color: tokens.textMuted }]}>
              {revealed
                ? `${player.nationality} • ${player.position}`
                : 'İpuçlarıyla futbolcuyu tahmin et!'}
            </Text>
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
    padding: 16,
    gap: 6,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  fallbackSub: {
    fontSize: 12.5,
    textAlign: 'center',
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
