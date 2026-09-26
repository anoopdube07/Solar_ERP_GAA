import { getDB } from '../db/index.ts';
import type { 
  DocumentDefinition,
  DocumentRequirementRule,
  DocumentRuleItem,
  LeadDocument,
  LeadDocumentChecklist,
  RuleEvaluationResult,
  RuleEvaluationItem,
 } from '../../shared/types.ts';
import { recordWorkflowHistory } from './auditService.ts';

export async function evaluateLeadDocuments(
  leadId: string,
  txClient?: any
): Promise<LeadDocumentChecklist> {
  const db = txClient || (await getDB());

  // 1. Fetch lead details
  const leadRes = await db.query(
    `SELECT id, lead_number, customer_name, customer_type, status, current_team, 
            documentation_status, b2c_loan_required, b2b_credit_extended
     FROM leads WHERE id = $1`,
    [leadId]
  );

  if (leadRes.rows.length === 0) {
    throw new Error('Lead not found for document evaluation');
  }
  const lead = leadRes.rows[0];

  // 2. Fetch custom field values for conditional evaluations
  const customValuesRes = await db.query(
    `SELECT field_key, value FROM lead_custom_field_values WHERE lead_id = $1`,
    [leadId]
  );
  const customValues: Record<string, string> = {};
  for (const row of customValuesRes.rows) {
    if (row.field_key) {
      customValues[row.field_key] = row.value || '';
    }
  }

  // 3. Fetch all active requirement rules applicable to this lead's customer type
  const rulesRes = await db.query(
    `SELECT * FROM document_requirement_rules 
     WHERE active = true AND deleted_at IS NULL AND (customer_type = $1 OR customer_type = 'BOTH')
     ORDER BY display_order ASC, created_at ASC`,
    [lead.customer_type]
  );

  // 4. Fetch all active or historically valid uploaded documents for this lead
  const docsRes = await db.query(
    `SELECT ld.*, COALESCE(ld.created_at, NOW()) as uploaded_at, u.name as uploader_name, dd.name as document_name, dd.code as document_code
     FROM lead_documents ld
     JOIN users u ON ld.uploaded_by = u.id
     JOIN document_definitions dd ON ld.document_definition_id = dd.id
     WHERE ld.lead_id = $1 AND ld.deleted_at IS NULL
     ORDER BY ld.created_at ASC`,
    [leadId]
  );
  const uploadedDocs: LeadDocument[] = docsRes.rows;

  // Group uploaded docs by definition id
  const docsByDefId: Record<string, LeadDocument[]> = {};
  for (const doc of uploadedDocs) {
    if (!docsByDefId[doc.document_definition_id]) {
      docsByDefId[doc.document_definition_id] = [];
    }
    docsByDefId[doc.document_definition_id].push(doc);
  }

  const evaluatedRules: RuleEvaluationResult[] = [];
  let totalApplicable = 0;
  let satisfiedCount = 0;

  for (const rule of rulesRes.rows) {
    // Check rule condition
    let applies = false;
    let conditionExplanation = '';

    if (rule.condition_type === 'ALWAYS') {
      applies = true;
      conditionExplanation = 'Mandatory for all ' + lead.customer_type + ' projects';
    } else if (rule.condition_type === 'IF_LOAN_REQUIRED') {
      applies = lead.b2c_loan_required === 'YES';
      conditionExplanation = applies
        ? 'Applies because Solar Loan is requested (YES)'
        : 'Does not apply (No Solar Loan requested)';
    } else if (rule.condition_type === 'IF_CREDIT_EXTENDED') {
      applies = lead.b2b_credit_extended === 'YES';
      conditionExplanation = applies
        ? 'Applies because Commercial Credit is extended (YES)'
        : 'Does not apply (No credit extended)';
    } else if (rule.condition_type === 'CUSTOM_FIELD_EQUALS') {
      const val = customValues[rule.condition_field_key] || '';
      applies = val.toLowerCase() === (rule.condition_expected_value || '').toLowerCase();
      conditionExplanation = `Applies when ${rule.condition_field_key} equals "${rule.condition_expected_value}"`;
    }

    // Fetch rule items (only consider active document definitions from Master Settings)
    const itemsRes = await db.query(
      `SELECT dri.*, dd.code as document_code, dd.name as document_name, dd.active as definition_active
       FROM document_rule_items dri
       JOIN document_definitions dd ON dri.document_definition_id = dd.id
       WHERE dri.rule_id = $1 AND dd.active = true AND dd.deleted_at IS NULL
       ORDER BY dri.created_at ASC`,
      [rule.id]
    );

    const requiredItems: RuleEvaluationItem[] = itemsRes.rows.map((item: any) => {
      const docs = docsByDefId[item.document_definition_id] || [];
      return {
        definition_id: item.document_definition_id,
        code: item.document_code,
        name: item.document_name,
        is_uploaded: docs.length > 0,
        uploaded_documents: docs,
      };
    });

    // If no active document definitions exist for this rule, the rule has no active requirements
    if (requiredItems.length === 0) {
      evaluatedRules.push({
        rule_id: rule.id,
        rule_name: rule.rule_name,
        description: rule.description,
        requirement_type: rule.requirement_type,
        condition_type: rule.condition_type,
        applies: false,
        condition_explanation: 'All document definitions for this rule are inactive in Master Settings',
        is_satisfied: true,
        required_items: [],
        missing_item_names: [],
      });
      continue;
    }

    if (!applies) {
      evaluatedRules.push({
        rule_id: rule.id,
        rule_name: rule.rule_name,
        description: rule.description,
        requirement_type: rule.requirement_type,
        condition_type: rule.condition_type,
        applies: false,
        condition_explanation: conditionExplanation,
        is_satisfied: true, // Not blocking
        required_items: requiredItems,
        missing_item_names: [],
      });
      continue;
    }

    totalApplicable++;

    // Evaluate satisfaction based on requirement type
    let isSatisfied = false;
    const missingNames: string[] = [];

    if (rule.requirement_type === 'INDIVIDUAL') {
      isSatisfied = requiredItems.length > 0 && requiredItems.every((item) => item.is_uploaded);
      if (!isSatisfied) {
        requiredItems.filter((i) => !i.is_uploaded).forEach((i) => missingNames.push(i.name));
      }
    } else if (rule.requirement_type === 'ALL_REQUIRED') {
      isSatisfied = requiredItems.length > 0 && requiredItems.every((item) => item.is_uploaded);
      if (!isSatisfied) {
        requiredItems.filter((i) => !i.is_uploaded).forEach((i) => missingNames.push(i.name));
      }
    } else if (rule.requirement_type === 'ANY_ONE_REQUIRED') {
      isSatisfied = requiredItems.some((item) => item.is_uploaded);
      if (!isSatisfied) {
        missingNames.push(`Any one of: ${requiredItems.map((i) => i.name).join(' OR ')}`);
      }
    }

    if (isSatisfied) {
      satisfiedCount++;
    }

    evaluatedRules.push({
      rule_id: rule.id,
      rule_name: rule.rule_name,
      description: rule.description,
      requirement_type: rule.requirement_type,
      condition_type: rule.condition_type,
      applies: true,
      condition_explanation: conditionExplanation,
      is_satisfied: isSatisfied,
      required_items: requiredItems,
      missing_item_names: missingNames,
    });
  }

  // Gate evaluation:
  // Gate is satisfied if all applicable rules are satisfied (or if there are no applicable active rules)
  const isGateSatisfied = totalApplicable === 0 || satisfiedCount === totalApplicable;

  const isCompletedHandoff =
    lead.current_team === 'REGISTRATION_1' ||
    lead.current_team === 'REGISTRATION_TEAM' ||
    lead.current_team === 'ACCOUNTS_PLACEHOLDER' ||
    lead.current_team === 'ACCOUNTS' ||
    lead.documentation_status === 'COMPLETED';

  const canUpload =
    (lead.status === 'QUALIFIED' || lead.documentation_status === 'PENDING') &&
    lead.current_team === 'LEAD';

  const canDelete = canUpload;

  let stageMessage = 'In ECP Documentation';
  if (isCompletedHandoff) {
    stageMessage = lead.customer_type === 'B2B'
      ? 'Documentation Complete — Handed off to Accounts'
      : 'Documentation Complete — Handed off to Registration 1';
  } else if (lead.status !== 'QUALIFIED' && lead.documentation_status !== 'PENDING') {
    stageMessage = 'Pre-Qualification (Documentation unlocks upon YES)';
  } else if (totalApplicable === 0) {
    stageMessage = 'No active document requirements — Ready for handoff';
  } else if (isGateSatisfied) {
    stageMessage = 'All document requirements satisfied';
  } else {
    stageMessage = `${satisfiedCount} of ${totalApplicable} requirement(s) satisfied`;
  }

  return {
    lead_id: leadId,
    is_gate_satisfied: isGateSatisfied,
    total_applicable_rules: totalApplicable,
    satisfied_rules_count: satisfiedCount,
    pending_rules_count: totalApplicable - satisfiedCount,
    rules: evaluatedRules,
    uploaded_documents: uploadedDocs,
    can_upload: canUpload,
    can_delete: canDelete,
    stage_message: stageMessage,
  };
}

/**
 * Transactional Gate Evaluation & Auto-Handoff Engine
 * When all required documents are satisfied (or none required), automatically hands off the lead:
 * - B2C leads -> REGISTRATION_1
 * - B2B leads -> ACCOUNTS_PLACEHOLDER
 * Concurrency protected: single execution guaranteed via atomic UPDATE.
 */
export async function checkAndPerformHandoff(
  leadId: string,
  actorId: string,
  actorName: string,
  txClient?: any
): Promise<{ handed_off: boolean; checklist: LeadDocumentChecklist }> {
  const db = txClient || (await getDB());

  // Fetch lead to know customer_type
  const leadRes = await db.query(
    'SELECT id, customer_type, current_team, status FROM leads WHERE id = $1',
    [leadId]
  );
  if (leadRes.rows.length === 0) {
    throw new Error('Lead not found for handoff check');
  }
  const lead = leadRes.rows[0];

  const checklist = await evaluateLeadDocuments(leadId, db);

  // If gate is satisfied and lead is currently in LEAD team and in documentation stage:
  if (checklist.is_gate_satisfied) {
    const nextTeam = lead.customer_type === 'B2B' ? 'ACCOUNTS_PLACEHOLDER' : 'REGISTRATION_1';
    const nextStatus = lead.customer_type === 'B2B' ? 'QUALIFIED' : 'DOCUMENTATION_COMPLETE';
    const nextTeamLabel = lead.customer_type === 'B2B' ? 'Accounts' : 'Registration 1';
    const nextDocStatus = checklist.total_applicable_rules === 0 ? 'NOT_APPLICABLE' : 'COMPLETED';
    const isActionRequired = nextTeam === 'REGISTRATION_1';

    // Atomically transition from LEAD team to next team
    const updateRes = await db.query(
      `UPDATE leads 
       SET current_team = $1,
           documentation_status = $2,
           status = $3,
           action_required = $4,
           updated_at = NOW()
       WHERE id = $5 
         AND current_team = 'LEAD' 
         AND (status = 'QUALIFIED' OR documentation_status = 'PENDING')
       RETURNING *`,
      [nextTeam, nextDocStatus, nextStatus, isActionRequired, leadId]
    );

    if (updateRes.rows.length === 1) {
      if (nextTeam === 'REGISTRATION_1') {
        try {
          const { RegistrationService } = await import('./registrationService.ts');
          await RegistrationService.ensureTasksForLead(leadId);
        } catch (e) {
          console.warn('Failed to initialize registration tasks:', e);
        }
      }

      // Record immutable workflow history
      await recordWorkflowHistory(db, {
        leadId,
        actorId,
        actorName,
        eventType: 'DOCUMENTATION_COMPLETED',
        previousState: 'QUALIFIED / LEAD_TEAM',
        newState: `${nextStatus} / ${nextTeam}`,
        remarks: `All applicable document requirements satisfied. Lead automatically handed off to ${nextTeamLabel}.`,
        metadata: {
          total_rules_satisfied: checklist.satisfied_rules_count,
          uploaded_documents_count: checklist.uploaded_documents.length,
          handed_off_to: nextTeam,
        },
      });

      return { handed_off: true, checklist };
    }
  }

  return { handed_off: false, checklist };
}
