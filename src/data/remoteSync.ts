import { RemoteSyncStatus, TenaBallQuestion } from '../types';
import { getCachedRemoteTenaBall, saveCachedRemoteTenaBall } from '../utils/storage';

/**
 * Configurable raw GitHub URL for remote TenaBall question updates.
 * Update `<OWNER>/<REPO>` once you publish your repository on GitHub.
 */
export const REMOTE_TENABALL_URL =
  'https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/football-tahmin-oyunu/main/src/data/tenaball.json';

const VALID_DIFFICULTIES = new Set(['kolay', 'orta', 'zor']);

/**
 * Strict schema validation for TenaBallQuestion[].
 * Rejects malformed payloads so corrupt remote files never overwrite valid local data.
 */
export function validateTenaBallSchema(payload: unknown): payload is TenaBallQuestion[] {
  if (!Array.isArray(payload) || payload.length === 0) return false;

  const seenIds = new Set<string>();
  for (const item of payload) {
    if (!item || typeof item !== 'object') return false;
    const q = item as Record<string, unknown>;

    if (typeof q.id !== 'string' || !q.id.trim() || seenIds.has(q.id)) return false;
    seenIds.add(q.id);

    if (typeof q.title !== 'string' || !q.title.trim()) return false;
    if (typeof q.category !== 'string' || !q.category.trim()) return false;
    if (typeof q.difficulty !== 'string' || !VALID_DIFFICULTIES.has(q.difficulty)) return false;
    if (typeof q.sourceUrl !== 'string' || !q.sourceUrl.startsWith('http')) return false;
    if (typeof q.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(q.asOf)) return false;
    if (typeof q.verified !== 'boolean') return false;

    if (!Array.isArray(q.answers) || q.answers.length !== 10) return false;
    for (const ans of q.answers) {
      if (typeof ans !== 'string' || !ans.trim()) return false;
    }
  }

  return true;
}

/**
 * Attempts to fetch updated TenaBall questions from REMOTE_TENABALL_URL with timeout.
 * Validates schema before caching. Falls back gracefully to local cache or bundled dataset.
 */
export async function syncRemoteTenaBallQuestions(
  bundledQuestions: TenaBallQuestion[]
): Promise<{ questions: TenaBallQuestion[]; status: RemoteSyncStatus }> {
  // 1. Try remote fetch with 5s timeout (skip if placeholder URL is untouched? still safe to try & fallback)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(REMOTE_TENABALL_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const json: unknown = await response.json();
      if (validateTenaBallSchema(json)) {
        const updatedAt = await saveCachedRemoteTenaBall(json);
        return {
          questions: json,
          status: {
            source: 'remote',
            questionCount: json.length,
            lastUpdatedAt: updatedAt,
          },
        };
      }
      throw new Error('Uzak soru verisi şema doğrulamasından geçemedi.');
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    // 2. Fallback to locally cached remote copy if valid
    const cached = await getCachedRemoteTenaBall();
    if (cached && validateTenaBallSchema(cached.questions)) {
      return {
        questions: cached.questions,
        status: {
          source: 'cache',
          questionCount: cached.questions.length,
          lastUpdatedAt: cached.updatedAt,
          error: err instanceof Error ? err.message : 'Bağlantı kurulamadı',
        },
      };
    }

    // 3. Fallback to bundled copy
    return {
      questions: bundledQuestions,
      status: {
        source: 'bundled',
        questionCount: bundledQuestions.length,
        error: err instanceof Error ? err.message : 'Çevrimdışı mod',
      },
    };
  }
}
