/**
 * Local-first storage: IndexedDB via Dexie. No backend, works offline.
 * The engines never touch this — persistence is an adapter around them.
 */

import Dexie, { type Table } from 'dexie'
import type { SessionRecord, UserItemState, UserNodeState } from '../engine/types'

export class FretPathDB extends Dexie {
  itemStates!: Table<UserItemState, string>
  nodeStates!: Table<UserNodeState, string>
  sessions!: Table<SessionRecord, string>

  constructor() {
    super('fretpath')
    this.version(1).stores({
      itemStates: 'itemId, dueDate',
      nodeStates: 'nodeId, status',
      sessions: 'id, date',
    })
    // v2: item states gained `bestBpm` (the metronome-graded personal best).
    // Indexes are unchanged; the upgrade only backfills the new field so old
    // rows read as a well-formed UserItemState (null = no drill best yet).
    this.version(2).stores({
      itemStates: 'itemId, dueDate',
      nodeStates: 'nodeId, status',
      sessions: 'id, date',
    }).upgrade((tx) =>
      tx
        .table('itemStates')
        .toCollection()
        .modify((state) => {
          if (state.bestBpm === undefined) state.bestBpm = null
        }),
    )
  }
}

export const db = new FretPathDB()
