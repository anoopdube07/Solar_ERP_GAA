import crypto from 'crypto';
import type { DBClient } from '../db/index.ts';

export interface WorkflowEventParams {
  leadId: string;
  actorId: string;
  actorName: string;
  eventType: string;
  previousState?: string | null;
  newState?: string | null;
  remarks?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordWorkflowHistory(
  dbOrTx: { query: (text: string, params?: unknown[]) => Promise<any> },
  params: WorkflowEventParams
) {
  const id = crypto.randomUUID();
  await dbOrTx.query(
    `INSERT INTO lead_workflow_history (
      id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, metadata_json, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      id,
      params.leadId,
      params.actorId,
      params.actorName,
      params.eventType,
      params.previousState || null,
      params.newState || null,
      params.remarks || null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  );
}
