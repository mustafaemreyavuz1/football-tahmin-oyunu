import teamsData from './teams.json';
import { Team } from '../types';
import { normalizeText } from '../utils/normalization';

export const LEAGUE_ORDER = [
  'Süper Lig',
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
] as const;

const ALL_TEAMS: Team[] = teamsData as Team[];

export function getAllTeams(): Team[] {
  return ALL_TEAMS;
}

export function getTeamById(id: string | null | undefined): Team | null {
  if (!id) return null;
  return ALL_TEAMS.find((t) => t.id === id) ?? null;
}

export interface LeagueGroup {
  league: string;
  country: string;
  teams: Team[];
}

export function getTeamsGroupedByLeague(query: string = ''): LeagueGroup[] {
  const normQuery = normalizeText(query);
  const filtered = normQuery
    ? ALL_TEAMS.filter(
        (t) =>
          normalizeText(t.name).includes(normQuery) ||
          normalizeText(t.league).includes(normQuery) ||
          normalizeText(t.country).includes(normQuery)
      )
    : ALL_TEAMS;

  const groups: LeagueGroup[] = [];
  for (const league of LEAGUE_ORDER) {
    const leagueTeams = filtered
      .filter((t) => t.league === league)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    if (leagueTeams.length > 0) {
      groups.push({
        league,
        country: leagueTeams[0].country,
        teams: leagueTeams,
      });
    }
  }
  return groups;
}
