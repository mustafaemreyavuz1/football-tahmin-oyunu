import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppContainer } from '../src/components/AppContainer';
import { SearchInput } from '../src/components/SearchInput';
import { TeamColorDot } from '../src/components/TeamColorDot';
import { getTeamsGroupedByLeague } from '../src/data/teamRepository';
import { useTheme } from '../src/theme/ThemeContext';
import { Team } from '../src/types';

export default function OnboardingScreen() {
  const { tokens, selectedTeam, completeOnboarding } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pickedTeamId, setPickedTeamId] = useState<string | null>(selectedTeam?.id ?? null);

  const sections = useMemo(
    () =>
      getTeamsGroupedByLeague(query).map((group) => ({
        title: `${group.league} (${group.country})`,
        data: group.teams,
      })),
    [query]
  );

  const handleConfirm = async (teamId: string | null) => {
    await completeOnboarding(teamId);
    router.replace('/');
  };

  return (
    <AppContainer>
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: tokens.footballGreen }]}>
          <Ionicons name="football" size={26} color={tokens.footballGreenText} />
        </View>
        <Text style={[styles.title, { color: tokens.text }]}>Hangi takımlısın?</Text>
        <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
          Seçtiğin takımın renkleri uygulamanın vurgu rengi olur. İstediğin zaman Ayarlar&apos;dan değiştirebilirsin.
        </Text>

        <View style={styles.searchWrap}>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Takım veya lig ara (örn. Galatasaray, Arsenal...)"
          />
        </View>

        <Pressable
          onPress={() => handleConfirm(null)}
          style={({ pressed }) => [
            styles.noTeamBtn,
            {
              backgroundColor: pickedTeamId === null ? tokens.accentSoft : tokens.surface,
              borderColor: pickedTeamId === null ? tokens.footballGreen : tokens.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.noTeamLeft}>
            <View style={[styles.defaultDot, { backgroundColor: tokens.footballGreen }]}>
              <Ionicons name="shield-outline" size={16} color={tokens.footballGreenText} />
            </View>
            <View>
              <Text style={[styles.teamName, { color: tokens.text }]}>Takımım yok</Text>
              <Text style={[styles.teamMeta, { color: tokens.textMuted }]}>
                Varsayılan futbol yeşili tema ile devam et
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={tokens.textMuted} />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item: Team) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: tokens.background }]}>
            <Text style={[styles.sectionTitle, { color: tokens.textMuted }]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }: { item: Team }) => {
          const isSelected = pickedTeamId === item.id;
          return (
            <Pressable
              onPress={() => setPickedTeamId(item.id)}
              style={({ pressed }) => [
                styles.teamRow,
                {
                  backgroundColor: isSelected ? tokens.accentSoft : tokens.surface,
                  borderColor: isSelected ? item.primaryColor : tokens.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.teamLeft}>
                <TeamColorDot
                  primaryColor={item.primaryColor}
                  secondaryColor={item.secondaryColor}
                  size={30}
                />
                <View>
                  <Text style={[styles.teamName, { color: tokens.text }]}>{item.name}</Text>
                  <Text style={[styles.teamMeta, { color: tokens.textMuted }]}>{item.league}</Text>
                </View>
              </View>
              {isSelected ? (
                <Ionicons name="checkmark-circle" size={22} color={tokens.footballGreen} />
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: tokens.textMuted }]}>
            Aramana uygun takım bulunamadı.
          </Text>
        }
      />

      <View style={[styles.footer, { backgroundColor: tokens.surface, borderTopColor: tokens.border }]}>
        <Pressable
          onPress={() => handleConfirm(pickedTeamId)}
          style={({ pressed }) => [
            styles.continueBtn,
            { backgroundColor: tokens.footballGreen, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.continueText, { color: tokens.footballGreenText }]}>
            {pickedTeamId ? 'Seçili Takımla Başla' : 'Varsayılan Tema ile Başla'}
          </Text>
        </Pressable>
      </View>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 4,
  },
  searchWrap: {
    marginTop: 14,
  },
  noTeamBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  noTeamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  defaultDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionHeader: {
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  teamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '700',
  },
  teamMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  empty: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  continueBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
