import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { shareResultText } from '../utils/share';

interface ResultModalProps {
  visible: boolean;
  onClose: () => void;
  won: boolean;
  title: string;
  subtitle: string;
  shareText: string;
  attributionText?: string;
  reportAction?: {
    label: string;
    reported: boolean;
    onPress: () => void;
  };
  onPlayUnlimited?: () => void;
  playUnlimitedLabel?: string;
}

export function ResultModal({
  visible,
  onClose,
  won,
  title,
  subtitle,
  shareText,
  attributionText,
  reportAction,
  onPlayUnlimited,
  playUnlimitedLabel = 'Yeni Bulmaca Oyna',
}: ResultModalProps) {
  const { tokens } = useTheme();
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const handleShare = async () => {
    const msg = await shareResultText(shareText);
    setShareFeedback(msg);
    setTimeout(() => setShareFeedback(null), 2500);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={[
              styles.badge,
              { backgroundColor: won ? tokens.success : tokens.danger },
            ]}
          >
            <Ionicons name={won ? 'trophy' : 'football'} size={28} color="#FFFFFF" />
          </View>

          <Text style={[styles.title, { color: tokens.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: tokens.textMuted }]}>{subtitle}</Text>

          <View
            style={[
              styles.previewBox,
              { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border },
            ]}
          >
            <Text style={[styles.previewText, { color: tokens.text }]}>{shareText}</Text>
          </View>

          {attributionText ? (
            <Text style={[styles.attributionText, { color: tokens.textMuted }]}>
              {attributionText}
            </Text>
          ) : null}

          {shareFeedback ? (
            <Text style={[styles.feedback, { color: tokens.success }]}>{shareFeedback}</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: tokens.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="share-social" size={18} color={tokens.accentText} />
              <Text style={[styles.primaryBtnText, { color: tokens.accentText }]}>
                Sonucu Paylaş
              </Text>
            </Pressable>

            {onPlayUnlimited ? (
              <Pressable
                onPress={onPlayUnlimited}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: tokens.footballGreen,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="refresh" size={18} color={tokens.footballGreenText} />
                <Text style={[styles.secondaryBtnText, { color: tokens.footballGreenText }]}>
                  {playUnlimitedLabel}
                </Text>
              </Pressable>
            ) : null}

            {reportAction ? (
              <Pressable
                onPress={reportAction.onPress}
                disabled={reportAction.reported}
                style={({ pressed }) => [
                  styles.reportBtn,
                  {
                    backgroundColor: tokens.surfaceElevated,
                    borderColor: reportAction.reported ? tokens.success : tokens.border,
                    opacity: reportAction.reported ? 0.8 : pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={reportAction.reported ? 'checkmark-circle-outline' : 'flag-outline'}
                  size={16}
                  color={reportAction.reported ? tokens.success : tokens.danger}
                />
                <Text
                  style={[
                    styles.reportBtnText,
                    { color: reportAction.reported ? tokens.success : tokens.text },
                  ]}
                >
                  {reportAction.label}
                </Text>
              </Pressable>
            ) : null}

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: tokens.textMuted }]}>Kapat</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  previewBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  feedback: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  closeBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  attributionText: {
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
