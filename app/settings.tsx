import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppContainer } from '../src/components/AppContainer';
import { Header } from '../src/components/Header';
import { SearchInput } from '../src/components/SearchInput';
import { TeamColorDot } from '../src/components/TeamColorDot';
import { useTheme } from '../src/theme/ThemeContext';
import { getTeamsGroupedByLeague } from '../src/data/teamRepository';
import { getTenaBallSyncStatus, refreshTenaBallQuestions } from '../src/data/tenaballRepository';
import { getAllPlayers } from '../src/data/playerRepository';
import { RemoteSyncStatus, ThemePreference } from '../src/types';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Sistem', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Açık', icon: 'sunny-outline' },
  { value: 'dark', label: 'Koyu', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { tokens, selectedTeam, themePreference, selectTeam, updateThemePreference } = useTheme();
  const [teamQuery, setTeamQuery] = useState('');
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [syncStatus, setSyncStatus] = useState<RemoteSyncStatus>(getTenaBallSyncStatus());
  const [syncing, setSyncing] = useState(false);

  const groupedTeams = useMemo(() => getTeamsGroupedByLeague(teamQuery), [teamQuery]);
  const playerCount = getAllPlayers().length;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const next = await refreshTenaBallQuestions();
      setSyncStatus(next);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AppContainer>
      <Header title="Ayarlar" subtitle="Tema, takım ve veri kaynakları" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Appearance */}
        <Text style={[styles.sectionTitle, { color: tokens.text }]}>Görünüm</Text>
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themePreference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => updateThemePreference(opt.value)}
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: active ? tokens.accent : tokens.surfaceElevated,
                      borderColor: active ? tokens.accent : tokens.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={active ? tokens.accentText : tokens.textMuted}
                  />
                  <Text
                    style={[
                      styles.themeBtnText,
                      { color: active ? tokens.accentText : tokens.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Favourite Team */}
        <Text style={[styles.sectionTitle, { color: tokens.text }]}>Favori Takım</Text>
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <View style={styles.currentTeamRow}>
            <View style={styles.teamInfo}>
              {selectedTeam ? (
                <TeamColorDot
                  primaryColor={selectedTeam.primaryColor}
                  secondaryColor={selectedTeam.secondaryColor}
                  size={32}
                />
              ) : (
                <View style={[styles.defaultBadge, { backgroundColor: tokens.footballGreen }]}>
                  <Ionicons name="football" size={16} color={tokens.footballGreenText} />
                </View>
              )}
              <View>
                <Text style={[styles.teamTitle, { color: tokens.text }]}>
                  {selectedTeam ? selectedTeam.name : 'Takımım yok (Varsayılan)'}
                </Text>
                <Text style={[styles.teamSub, { color: tokens.textMuted }]}>
                  {selectedTeam ? `${selectedTeam.league} • ${selectedTeam.country}` : 'Futbol yeşili varsayılan tema'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowTeamPicker((prev) => !prev)}
              style={[styles.changeBtn, { backgroundColor: tokens.accent }]}
            >
              <Text style={[styles.changeBtnText, { color: tokens.accentText }]}>
                {showTeamPicker ? 'Kapat' : 'Değiştir'}
              </Text>
            </Pressable>
          </View>

          {showTeamPicker && (
            <View style={styles.pickerWrap}>
              <SearchInput
                value={teamQuery}
                onChangeText={setTeamQuery}
                placeholder="Takım veya lig ara..."
              />

              <Pressable
                onPress={async () => {
                  await selectTeam(null);
                  setShowTeamPicker(false);
                }}
                style={[
                  styles.pickerRow,
                  {
                    backgroundColor: !selectedTeam ? tokens.accentSoft : tokens.surfaceElevated,
                    borderColor: tokens.border,
                    marginTop: 10,
                  },
                ]}
              >
                <Text style={[styles.pickerRowText, { color: tokens.text }]}>
                  Takımım yok (Varsayılan Tema)
                </Text>
                {!selectedTeam && <Ionicons name="checkmark" size={18} color={tokens.accent} />}
              </Pressable>

              {groupedTeams.map((group) => (
                <View key={group.league} style={styles.leagueBlock}>
                  <Text style={[styles.leagueHeader, { color: tokens.textMuted }]}>
                    {group.league} ({group.country})
                  </Text>
                  {group.teams.map((team) => {
                    const active = selectedTeam?.id === team.id;
                    return (
                      <Pressable
                        key={team.id}
                        onPress={async () => {
                          await selectTeam(team.id);
                          setShowTeamPicker(false);
                        }}
                        style={[
                          styles.pickerRow,
                          {
                            backgroundColor: active ? tokens.accentSoft : 'transparent',
                            borderColor: tokens.border,
                          },
                        ]}
                      >
                        <View style={styles.teamInfo}>
                          <TeamColorDot
                            primaryColor={team.primaryColor}
                            secondaryColor={team.secondaryColor}
                            size={22}
                          />
                          <Text style={[styles.pickerRowText, { color: tokens.text }]}>
                            {team.name}
                          </Text>
                        </View>
                        {active && <Ionicons name="checkmark" size={18} color={tokens.accent} />}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Remote Questions Sync */}
        <Text style={[styles.sectionTitle, { color: tokens.text }]}>Soru Verisi ve Güncelleme</Text>
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={[styles.metaLine, { color: tokens.text }]}>
            Aktif TenaBall Soru Sayısı:{' '}
            <Text style={{ fontWeight: '800' }}>{syncStatus.questionCount}</Text>
          </Text>
          <Text style={[styles.metaLine, { color: tokens.textMuted }]}>
            Kaynak:{' '}
            {syncStatus.source === 'remote'
              ? 'Uzak GitHub Güncellemesi'
              : syncStatus.source === 'cache'
                ? 'Yerel Önbellek'
                : 'Uygulama İçi Paketli Veri'}
          </Text>
          <Text style={[styles.metaLine, { color: tokens.textMuted }]}>
            Oyuncu Havuzu: {playerCount} futbolcu (Who Are Ya & Wordle)
          </Text>
          <Pressable
            onPress={handleSync}
            disabled={syncing}
            style={[
              styles.syncBtn,
              { backgroundColor: tokens.footballGreen, opacity: syncing ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="cloud-download-outline" size={16} color={tokens.footballGreenText} />
            <Text style={[styles.syncBtnText, { color: tokens.footballGreenText }]}>
              {syncing ? 'Kontrol ediliyor...' : 'Uzak Soruları Kontrol Et'}
            </Text>
          </Pressable>
        </View>

        {/* Image Attributions & Open Data */}
        <Text style={[styles.sectionTitle, { color: tokens.text }]}>Görsel Lisans ve Atıflar</Text>
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={[styles.attributionText, { color: tokens.textMuted }]}>
            Who Are Ya oyunundaki tüm futbolcu fotoğrafları Wikimedia Commons üzerinden Creative
            Commons (CC BY / CC BY-SA) veya Kamu Malı (Public Domain) lisanslarıyla sunulur. Her
            bulmacada ilgili fotoğrafın lisans ve kaynak bilgisi doğrudan ekran altında gösterilir.
            Kulüp armaları veya logoları kullanılmaz; takım temaları yalnızca kulüp renkleriyle
            oluşturulur.
          </Text>
        </View>
      </ScrollView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    paddingBottom: 36,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  themeBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  currentTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  defaultBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  teamSub: {
    fontSize: 12,
    marginTop: 1,
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  changeBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  pickerWrap: {
    marginTop: 14,
  },
  leagueBlock: {
    marginTop: 12,
  },
  leagueHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  pickerRowText: {
    fontSize: 14,
    fontWeight: '600',
  },
  metaLine: {
    fontSize: 13.5,
    marginBottom: 4,
  },
  syncBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  syncBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  attributionText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
