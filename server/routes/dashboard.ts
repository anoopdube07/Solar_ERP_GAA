import express from 'express';
import { getDB } from '../db/index.ts';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.ts';
import { isTodayIST } from '../../shared/timezone.ts';

const router = express.Router();

const getMetricsHandler = async (req: AuthenticatedRequest, res: any) => {
  try {
    const user = req.user!;
    const db = await getDB();

    let leadScopeWhere = '';
    const params: any[] = [];

    if (user.role === 'LEAD') {
      params.push(user.id);
      leadScopeWhere = `WHERE (l.owner_id = $${params.length} OR l.created_by = $${params.length})`;
    }

    // Leads in scope with receipts, follow-ups, and computed project stages
    const leadsRes = await db.query(
      `SELECT l.id, l.lead_number, l.customer_name, l.mobile_number, l.customer_type, l.status, l.current_team, l.action_required,
              l.b2c_loan_required, l.b2b_credit_extended, l.requested_credit_amount, l.approved_credit_amount,
              l.owner_remarks, l.total_project_value, l.created_at,
              u_owner.name as owner_name,
              COALESCE(fu_agg.follow_up_count, 0)::int as follow_up_count,
              (COALESCE(fu_agg.follow_up_count, 0) > 0) as has_follow_up,
              COALESCE(rec_agg.total_received, 0)::numeric as total_received,
              CASE
                WHEN l.status = 'LOST' THEN 'LOST'
                WHEN l.status NOT IN ('QUALIFIED', 'DOCUMENTATION_COMPLETE') THEN 'LEAD'
                WHEN (l.status = 'QUALIFIED' OR l.documentation_status = 'PENDING') AND l.current_team IN ('LEAD', 'LEAD_TEAM') THEN 'IN_DOCS'
                WHEN l.current_team IN ('DISPATCH', 'DISPATCH_TEAM') THEN 'DISPATCH'
                WHEN l.current_team IN ('INSTALLATION_MANAGER', 'INSTALLATION_TEAM') THEN 'INSTALLATION'
                ELSE COALESCE(reg_agg.reg_stage, 'REGISTRATION_1')
              END as project_stage
       FROM leads l
       JOIN users u_owner ON l.owner_id = u_owner.id
       LEFT JOIN (
         SELECT lead_id, COUNT(*) as follow_up_count
         FROM follow_ups
         GROUP BY lead_id
       ) fu_agg ON l.id = fu_agg.lead_id
       LEFT JOIN (
         SELECT lead_id, SUM(amount) as total_received
         FROM customer_receipts
         WHERE status = 'CLEARED'
         GROUP BY lead_id
       ) rec_agg ON l.id = rec_agg.lead_id
       LEFT JOIN LATERAL (
         SELECT 
           CASE
             WHEN COUNT(*) = 0 THEN 'REGISTRATION_1'
             WHEN bool_and(status = 'COMPLETED' OR status = 'NOT_APPLICABLE') THEN 'COMPLETED'
             WHEN bool_and((stage = 'REGISTRATION_1' AND (status = 'COMPLETED' OR status = 'NOT_APPLICABLE')) OR stage != 'REGISTRATION_1')
                  AND bool_and((stage = 'NET_METERING' AND (status = 'COMPLETED' OR status = 'NOT_APPLICABLE')) OR stage != 'NET_METERING')
                  THEN 'REGISTRATION_2'
             WHEN bool_and((stage = 'REGISTRATION_1' AND (status = 'COMPLETED' OR status = 'NOT_APPLICABLE')) OR stage != 'REGISTRATION_1')
                  THEN 'NET_METERING'
             ELSE 'REGISTRATION_1'
           END as reg_stage
         FROM registration_tasks
         WHERE lead_id = l.id
       ) reg_agg ON true
       ${leadScopeWhere}
       ORDER BY l.created_at DESC`,
      params
    );

    const allLeads = leadsRes.rows;

    // Follow-ups query to find today's scheduled follow-ups
    const fuScopeWhere = user.role === 'LEAD' ? `WHERE (l.owner_id = '${user.id}' OR l.created_by = '${user.id}')` : '';
    const fuRes = await db.query(
      `SELECT fu.id, fu.lead_id, fu.call_sequence, fu.scheduled_at, fu.remarks,
              l.lead_number, l.customer_name, l.mobile_number, l.customer_type,
              u_owner.name as owner_name
       FROM follow_ups fu
       JOIN leads l ON fu.lead_id = l.id
       JOIN users u_owner ON l.owner_id = u_owner.id
       ${fuScopeWhere ? fuScopeWhere + ' AND' : 'WHERE'} fu.completed = false
       ORDER BY fu.scheduled_at ASC`
    );

    const todayFollowUps = fuRes.rows.filter((f) => isTodayIST(f.scheduled_at));

    // Calculate separated metrics for B2C and B2B
    const computeTypeMetrics = (type: 'B2C' | 'B2B') => {
      const typeLeads = allLeads.filter((l) => l.customer_type === type);
      const total_leads = typeLeads.length;
      const site_visit_pending = typeLeads.filter((l) => l.status === 'SITE_VISIT_PENDING').length;
      const action_required = typeLeads.filter(
        (l) =>
          l.status !== 'LOST' &&
          l.status !== 'SITE_VISIT_PENDING' &&
          l.status !== 'ESCALATED_TO_OWNER' &&
          l.status !== 'OWNER_CREDIT_APPROVAL' &&
          ['LEAD', 'LEAD_TEAM'].includes(l.current_team) &&
          (l.action_required || l.status === 'PENDING')
      ).length;
      const follow_up_scheduled = typeLeads.filter((l) => l.has_follow_up && l.status !== 'LOST' && l.status !== 'QUALIFIED' && l.status !== 'DOCUMENTATION_COMPLETE').length;
      const escalated = typeLeads.filter((l) => l.status === 'ESCALATED_TO_OWNER' || l.status === 'OWNER_CREDIT_APPROVAL' || l.current_team === 'OWNER').length;
      const lost = typeLeads.filter((l) => l.status === 'LOST').length;

      const qualifiedLeads = typeLeads.filter(
        (l) =>
          (l.status === 'QUALIFIED' || l.status === 'DOCUMENTATION_COMPLETE') &&
          l.status !== 'SITE_VISIT_PENDING' &&
          l.status !== 'LOST' &&
          l.status !== 'PENDING'
      );

      const qualified_total = qualifiedLeads.length;

      const stages = {
        in_docs: qualifiedLeads.filter((l) => l.project_stage === 'IN_DOCS').length,
        registration_1: qualifiedLeads.filter((l) => l.project_stage === 'REGISTRATION_1').length,
        net_metering: qualifiedLeads.filter((l) => l.project_stage === 'NET_METERING').length,
        registration_2: qualifiedLeads.filter((l) => l.project_stage === 'REGISTRATION_2').length,
        dispatch: qualifiedLeads.filter((l) => l.project_stage === 'DISPATCH').length,
        installation: qualifiedLeads.filter((l) => l.project_stage === 'INSTALLATION').length,
        completed: qualifiedLeads.filter((l) => l.project_stage === 'COMPLETED').length,
      };

      const b2b_stages = {
        credit_approval_pending: qualifiedLeads.filter(
          (l) =>
            (l.b2b_credit_extended === 'YES' && l.owner_credit_decision !== 'APPROVED') ||
            l.status === 'OWNER_CREDIT_APPROVAL' ||
            l.status === 'ESCALATED_TO_OWNER'
        ).length,
        dispatch: qualifiedLeads.filter(
          (l) =>
            l.project_stage === 'DISPATCH' ||
            ['DISPATCH', 'DISPATCH_TEAM'].includes(l.current_team) ||
            ['READY_FOR_DISPATCH', 'DISPATCHED'].includes(l.dispatch_status as string)
        ).length,
        account: qualifiedLeads.filter(
          (l) =>
            l.current_team === 'ACCOUNTS' ||
            l.current_team === 'ACCOUNTS_PLACEHOLDER' ||
            l.dispatch_status === 'PENDING_ADVANCE' ||
            l.project_stage === 'ACCOUNTS'
        ).length,
        completed: qualifiedLeads.filter(
          (l) =>
            l.project_stage === 'COMPLETED' ||
            l.status === 'DOCUMENTATION_COMPLETE' ||
            l.dispatch_status === 'DELIVERED'
        ).length,
      };

      const total_contract_value = qualifiedLeads.reduce((sum, l) => sum + (Number(l.total_project_value) || 0), 0);
      const total_received = qualifiedLeads.reduce((sum, l) => sum + (Number(l.total_received) || 0), 0);
      const total_receivable = Math.max(0, total_contract_value - total_received);

      return {
        total_leads,
        site_visit_pending,
        action_required,
        follow_up_scheduled,
        escalated,
        lost,
        qualified_total,
        stages,
        b2b_stages,
        total_contract_value,
        total_received,
        total_receivable,
      };
    };

    const b2cMetrics = computeTypeMetrics('B2C');
    const b2bMetrics = computeTypeMetrics('B2B');

    // General counts for backward compatibility
    let pendingCount = 0;
    let actionRequiredCount = 0;
    let inFollowUpCount = 0;
    let siteVisitsPendingCount = 0;
    let lostCount = 0;
    let qualifiedCount = 0;
    let inDocumentationCount = 0;

    for (const lead of allLeads) {
      if (lead.status === 'PENDING') pendingCount++;
      if (lead.action_required) actionRequiredCount++;
      if (lead.has_follow_up && (lead.status === 'PENDING' || lead.status === 'SITE_VISIT_PENDING')) {
        inFollowUpCount++;
      }
      if (lead.status === 'SITE_VISIT_PENDING') siteVisitsPendingCount++;
      if (lead.status === 'LOST') lostCount++;
      if (lead.status === 'QUALIFIED' || lead.status === 'DOCUMENTATION_COMPLETE') qualifiedCount++;
      if (lead.project_stage === 'IN_DOCS') inDocumentationCount++;
    }

    res.json({
      metrics: {
        total_leads: allLeads.length,
        pending_leads: pendingCount,
        action_required_leads: actionRequiredCount,
        followups_due_today: todayFollowUps.length,
        in_follow_up: inFollowUpCount,
        site_visits_pending: siteVisitsPendingCount,
        lost_leads: lostCount,
        in_documentation: inDocumentationCount,
        qualified_leads: qualifiedCount,
        b2c: b2cMetrics,
        b2b: b2bMetrics,
      },
      today_followups: todayFollowUps,
    });
  } catch (err: any) {
    console.error('Error computing dashboard metrics:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard metrics.' });
  }
};

router.get('/', requireAuth, getMetricsHandler);
router.get('/metrics', requireAuth, getMetricsHandler);

export default router;
