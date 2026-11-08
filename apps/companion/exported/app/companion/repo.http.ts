/**
 * The companion's REST contract, spoken through the app's own `useApi`, so the bearer token,
 * the `{ data }` envelope and the 401 hand-off to sign-in all behave exactly
 * as they do everywhere else in the product.
 *
 * Nothing here caches or retries: the store above it owns optimistic writes
 * and the offline outbox, and PowerSync replaces this file later without a
 * screen noticing.
 */
import { ApiError, useApi } from '~/composables/useApi'
import type { CompanionRepo, IcsImportResult } from './repo'
import type {
  Card,
  Check,
  CheckSitting,
  ClassView,
  CollectionName,
  DocState,
  GoalDraft,
  Item,
  Readiness,
  Row,
  Signal,
  Snapshot,
  Today,
  Uuid,
} from './types'

const BASE = '/companion'

export function createHttpRepo(): CompanionRepo {
  const api = useApi()

  return {
    mode: 'http',

    bootstrap: () => api.get<Snapshot>(`${BASE}/bootstrap`),

    changes: (since) => api.get<Snapshot>(`${BASE}/changes`, { query: { since } }),

    list: <T extends Row>(collection: CollectionName, filter?: Record<string, string | number | boolean>) =>
      api.get<T[]>(`${BASE}/${collection}`, { query: filter }),

    /*
     * One door for create and update. The client always owns the id (offline
     * use and PowerSync both need that), so "does it exist yet" is a question
     * only the server can answer: PATCH first, and a 404 means it is new.
     * Rows the store just made carry no `created_at`, which lets it skip the
     * round trip and POST straight away.
     */
    async upsert<T extends Row>(collection: CollectionName, row: Partial<T> & { id: Uuid }): Promise<T> {
      if (!row.created_at) {
        return api.post<T>(`${BASE}/${collection}`, row)
      }
      try {
        return await api.patch<T>(`${BASE}/${collection}/${row.id}`, row)
      } catch (error) {
        if (error instanceof ApiError && error.isNotFound) {
          return api.post<T>(`${BASE}/${collection}`, row)
        }
        throw error
      }
    },

    async remove(collection, id) {
      await api.del(`${BASE}/${collection}/${id}`)
    },

    today: (date) => api.get<Today>(`${BASE}/today`, { query: { date } }),

    async rebuildPlan(date) {
      await api.post(`${BASE}/plan/rebuild`, undefined, { query: { date } })
    },

    readiness: (deadlineId) => api.get<Readiness>(`${BASE}/deadlines/${deadlineId}/readiness`),

    async applySignal(id, factIndexes, subjects) {
      await api.post(
        `${BASE}/signals/${id}/apply`,
        // Planner and inbox: `subjects`, the course picked per fact.
        { ...(factIndexes ? { facts_indexes: factIndexes } : {}), ...(subjects ? { subjects } : {}) },
      )
    },

    async dismissSignal(id) {
      await api.post(`${BASE}/signals/${id}/dismiss`, {})
    },

    reviewCard: (id, review) => api.post<Card>(`${BASE}/cards/${id}/review`, review),

    // The model writes and marks checks, so a 503 here means it's down; the
    // check page keeps the answer and offers to try the marking again.
    startCheck: (body) => api.post<CheckSitting>(`${BASE}/checks`, body, { timeout: 90_000 }),

    answerCheck: (id, body) => api.post<Check>(`${BASE}/checks/${id}/answer`, body, { timeout: 60_000 }),

    classOf: (deadlineId) => api.get<ClassView>(`${BASE}/deadlines/${deadlineId}/class`),

    pageDoc: (itemId) => api.get<DocState>(`${BASE}/items/${itemId}/doc`),

    async pushDocUpdate(itemId, update) {
      await api.post(`${BASE}/items/${itemId}/updates`, { update })
    },

    upload(file, where) {
      const form = new FormData()
      form.append('file', file)
      if (where.subject_id) form.append('subject_id', where.subject_id)
      if (where.session_id) form.append('session_id', where.session_id)
      return api.post<Item>(`${BASE}/items/upload`, form)
    },

    ingestText: (text, channel, subjectId) =>
      api.post<Signal[]>(`${BASE}/ingest/text`, { text, channel, subject_id: subjectId }),

    ingestIcs: (source) => api.post<IcsImportResult>(`${BASE}/ingest/ics`, source),

    ingestFile(file) {
      const form = new FormData()
      form.append('file', file)
      return api.post<Signal[]>(`${BASE}/ingest/file`, form)
    },

    goalFromSentence: (sentence, answers) =>
      api.post<GoalDraft>(`${BASE}/goals/from-sentence`, { sentence, answers }),

    // Google: Drive imports and the calendar link (routes/api/companion-google.php).
    importDriveFile(file, where) {
      const form = new FormData()
      form.append('file', file)
      for (const [key, value] of Object.entries(where)) if (value) form.append(key, value)
      return api.post<Item>(`${BASE}/google/drive/files`, form)
    },

    calendarFeed: () => api.get<{ url: string | null }>(`${BASE}/feed`),

    newCalendarFeed: () => api.post<{ url: string }>(`${BASE}/feed`),
  }
}
