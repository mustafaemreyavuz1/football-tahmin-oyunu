import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppContainer } from '../src/components/AppContainer';
import { Header } from '../src/components/Header';
import { SearchInput } from '../src/components/SearchInput';
import { TeamColorDot } from '../src/components/TeamColorDot';
import { useTheme } from '../src/theme/ThemeContext';
import { getTeamsGroupedByLeague } from '../src/data/teamRepository';
import {
  getTenaBallCounts,
  getTenaBallSyncStatus,
  refreshTenaBallQuestions,
} from '../src/data/tenaballRepository';
import { getGuessPoolCount, getPuzzlePool } from '../src/data/playerRepository';
import { RemoteSyncStatus, TenaBallErrorReport, ThemePreference } from '../src/types';
import {
  clearTenaBallErrorReports,
  getAllowUnverifiedTenaBall,
  getTenaBallErrorReports,
  setAllowUnverifiedTenaBall,
} from '../src/utils/storage';
import { shareResultText } from '../src/utils/share';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'system', label: 'Sistem', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Açık', icon: 'sunny-outline' },
  { value: 'dark', label: 'Koyu', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { tokens, selectedTeam, themePreference, selectTeam, updateThemePreference } = useTheme();
  const router = useRouter();
  const [teamQuery, setTeamQuery] = useState('');
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [syncStatus, setSyncStatus] = useState<RemoteSyncStatus>(getTenaBallSyncStatus());
  const [syncing, setSyncing] = useState(false);

  const [allowUnverified, setAllowUnverified] = useState(false);
  const [errorReports, setErrorReports] = useState<TenaBallErrorReport[]>([]);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [allow, reports] = await Promise.all([
          getAllowUnverifiedTenaBall(),
          getTenaBallErrorReports(),
        ]);
        if (!active) return;
        setAllowUnverified(allow);
        setErrorReports(reports);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const groupedTeams = useMemo(() => getTeamsGroupedByLeague(teamQuery), [teamQuery]);
  const puzzlePoolCount = getPuzzlePool().length;
  const guessPoolCount = getGuessPoolCount();
  const tenaBallCounts = getTenaBallCounts();

  const handleToggleUnverified = async (next: boolean) => {
    setAllowUnverified(next);
    await setAllowUnverifiedTenaBall(next);
  };

  const handleShareErrorReports = async () => {
    if (errorReports.length === 0) return;
    const lines = [
      '⚽ TenaBall Hata Bildirimleri (Football Tahmin Oyunu)',
      '',
      ...errorReports.map((r) => `- ${r.id}: ${r.title}`),
    ];
    const msg = await shareResultText(lines.join('\n'));
    setShareMessage(msg);
    setTimeout(() => setShareMessage(null), 2500);
  };

  const handleClearErrorReports = async () => {
    await clearTenaBallErrorReports();
    setErrorReports([]);
  };

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
      <Header title="Ayarlar" subtitle="Tema, takım, TenaBall ve lisanslar" />
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
                  {selectedTeam
                    ? `${selectedTeam.league} • ${selectedTeam.country}`
                    : 'Futbol yeşili varsayılan tema'}
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

        {/* TenaBall Settings & Unverified Switch */}
        <Text style={[styles.sectionTitle, { color: tokens.text }]}>TenaBall Ayarları</Text>
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={[styles.switchTitle, { color: tokens.text }]}>
                Doğrulanmamış listeleri oyna
              </Text>
              <Text style={[styles.switchDesc, { color: tokens.textMuted }]}>
                Açıkken henüz insan doğrulamasından geçmemiş aktif listeler de oynanabilir ve
                ekranda &quot;Doğrulanmamış liste&quot; etiketi görünür. Gizli listeler her durumda
                kapalı kalır.
              </Text>
            </View>
            <Switch
              value={allowUnverified}
              onValueChange={handleToggleUnverified}
              trackColor={{ false: tokens.border, true: tokens.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* TenaBall Error Reports */}
        <Text style={[styles.sectionTitle, { color: tokens.text }]}>
          Hata Bildirimleri ({errorReports.length})
        </Text>
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          {errorReports.length === 0 ? (
            <Text style={[styles.attributionText, { color: tokens.textMuted }]}>
              Henüz hata bildirilen bir TenaBall listesi yok. Oyun sonunda &quot;Bu listede hata
              var&quot; butonuna basarak buraya ekleyebilirsin.
            </Text>
          ) : (
            <View style={styles.reportsWrap}>
              {errorReports.map((r) => (
                <View
                  key={r.id}
                  style={[styles.reportRow, { borderColor: tokens.border }]}
                >
                  <Text style={[styles.reportId, { color: tokens.accent }]}>{r.id}</Text>
                  <Text style={[styles.reportTitle, { color: tokens.text }]} numberOfLines={2}>
                    {r.title}
                  </Text>
                </View>
              ))}

              {shareMessage ? (
                <Text style={[styles.shareFeedback, { color: tokens.success }]}>
                  {shareMessage}
                </Text>
              ) : null}

              <View style={styles.reportActions}>
                <Pressable
                  onPress={handleShareErrorReports}
                  style={[styles.reportActionBtn, { backgroundColor: tokens.accent }]}
                >
                  <Ionicons name="share-social-outline" size={16} color={tokens.accentText} />
                  <Text style={[styles.reportActionText, { color: tokens.accentText }]}>
                    Listeyi Paylaş
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleClearErrorReports}
                  style={[
                    styles.reportActionBtn,
                    { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border, borderWidth: 1 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={16} color={tokens.danger} />
                  <Text style={[styles.reportActionText, { color: tokens.danger }]}>Temizle</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Remote Questions Sync */}
        <Text style={[styles.sectionTitle, { color: tokens.text }]}>Soru Verisi ve Güncelleme</Text>
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={[styles.metaLine, { color: tokens.text }]}>
            Doğrulanmış Oynanabilir TenaBall Listesi:{' '}
            <Text style={{ fontWeight: '800' }}>{tenaBallCounts.verifiedPlayable}</Text> /{' '}
            {tenaBallCounts.visible} aktif ({tenaBallCounts.hidden} gizli)
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
            Bulmaca Havuzu (Who Are Ya & Wordle): {puzzlePoolCount} doğrulanmış futbolcu
          </Text>
          <Text style={[styles.metaLine, { color: tokens.textMuted }]}>
            Tahmin & Arama Havuzu: {guessPoolCount} futbolcu (Wikidata CC0)
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
            Commons (CC BY / CC BY-SA), GFDL veya Kamu Malı (Public Domain) lisanslarıyla sunulur.
            Oyun sırasında ipucu vermemek adına atıf gizlenir; oyun bitiminde sonuç ekranında ve
            aşağıdaki Görsel Atıfları sayfasında eksiksiz olarak gösterilir.
          </Text>
          <Pressable
            onPress={() => router.push('/attributions')}
            style={[styles.attributionsBtn, { backgroundColor: tokens.accent }]}
          >
            <Ionicons name="images-outline" size={16} color={tokens.accentText} />
            <Text style={[styles.syncBtnText, { color: tokens.accentText }]}>
              Görsel Atıfları ({puzzlePoolCount} Oyuncu)
            </Text>
            <Ionicons name="chevron-forward" size={16} color={tokens.accentText} />
          </Pressable>
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchTextWrap: {
    flex: 1,
    gap: 3,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  switchDesc: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  reportsWrap: {
    gap: 8,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  reportId: {
    fontSize: 12.5,
    fontWeight: '900',
    minWidth: 52,
  },
  reportTitle: {
    fontSize: 13,
    flex: 1,
  },
  shareFeedback: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  reportActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reportActionText: {
    fontSize: 13,
    fontWeight: '800',
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
  attributionsBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
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
