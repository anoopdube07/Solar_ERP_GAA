import express from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.ts';
import { AccountsService } from '../services/accountsService.ts';

const router = express.Router();

// 1. GET /api/accounts/metrics - Dashboard KPI counters
router.get('/metrics', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const metrics = await AccountsService.getAccountsMetrics();
    res.json({ metrics });
  } catch (err: any) {
    console.error('Error fetching accounts metrics:', err);
    res.status(500).json({ error: 'Failed to retrieve accounts metrics.' });
  }
});

// 2. GET /api/accounts/receipts - Filterable receipts ledger
router.get('/receipts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { lead_id, receipt_type, payer_type, search, status } = req.query as {
      lead_id?: string;
      receipt_type?: string;
      payer_type?: string;
      search?: string;
      status?: string;
    };

    const receipts = await AccountsService.getReceipts({
      lead_id,
      receipt_type,
      payer_type,
      search,
      status,
    });

    res.json({ receipts });
  } catch (err: any) {
    console.error('Error fetching receipts:', err);
    res.status(500).json({ error: 'Failed to retrieve receipts.' });
  }
});

// 3. POST /api/accounts/receipts - Record a new customer receipt
router.post('/receipts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const {
      lead_id,
      amount,
      receipt_date,
      payment_mode,
      reference_number,
      receipt_type,
      payer_type,
      payer_name,
      bank_name,
      deposited_in_account,
      status,
      remarks,
    } = req.body;

    const newReceipt = await AccountsService.recordReceipt({
      lead_id,
      amount: Number(amount),
      receipt_date,
      payment_mode,
      reference_number,
      receipt_type,
      payer_type,
      payer_name,
      bank_name,
      deposited_in_account,
      status,
      remarks,
      actor_id: user.id,
      actor_name: user.name,
    });

    res.status(201).json({
      success: true,
      message: `Receipt ${newReceipt.receipt_number} recorded successfully.`,
      receipt: newReceipt,
    });
  } catch (err: any) {
    console.error('Error recording receipt:', err);
    res.status(400).json({ error: err.message || 'Failed to record receipt.' });
  }
});

// 4. GET /api/accounts/follow-ups - Follow-ups list
router.get('/follow-ups', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { lead_id, status, due_today, overdue, search } = req.query as {
      lead_id?: string;
      status?: string;
      due_today?: string;
      overdue?: string;
      search?: string;
    };

    const followUps = await AccountsService.getFollowUps({
      lead_id,
      status,
      only_due_today: due_today === 'true',
      only_overdue: overdue === 'true',
      search,
    });

    res.json({ followUps });
  } catch (err: any) {
    console.error('Error fetching receipt follow-ups:', err);
    res.status(500).json({ error: 'Failed to retrieve follow-ups.' });
  }
});

// 5. POST /api/accounts/follow-ups - Record a receipt follow-up
router.post('/follow-ups', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const {
      lead_id,
      follow_up_date,
      promised_payment_date,
      promised_amount,
      contact_person,
      contact_phone,
      status,
      remarks,
      outcome_notes,
    } = req.body;

    const newFollowUp = await AccountsService.recordFollowUp({
      lead_id,
      follow_up_date,
      promised_payment_date,
      promised_amount,
      contact_person,
      contact_phone,
      status,
      remarks,
      outcome_notes,
      actor_id: user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Payment follow-up logged successfully.',
      followUp: newFollowUp,
    });
  } catch (err: any) {
    console.error('Error recording follow-up:', err);
    res.status(400).json({ error: err.message || 'Failed to record follow-up.' });
  }
});

// 6. PATCH /api/accounts/follow-ups/:id - Update follow-up status / outcome
router.patch('/follow-ups/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { status, outcome_notes, promised_payment_date, promised_amount } = req.body;

    const updated = await AccountsService.updateFollowUpStatus({
      id,
      status,
      outcome_notes,
      promised_payment_date,
      promised_amount,
      actor_id: user.id,
    });

    res.json({
      success: true,
      message: 'Follow-up updated successfully.',
      followUp: updated,
    });
  } catch (err: any) {
    console.error('Error updating follow-up:', err);
    res.status(400).json({ error: err.message || 'Failed to update follow-up.' });
  }
});

// 7. GET /api/accounts/leads - Accounts lead overview with credit terms & dispatch status
router.get('/leads', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { customer_type, search, dispatch_status, credit_compliance, owner_approval } =
      req.query as {
        customer_type?: 'B2C' | 'B2B' | 'ALL';
        search?: string;
        dispatch_status?: string;
        credit_compliance?: string;
        owner_approval?: string;
      };

    const leads = await AccountsService.getAccountsLeadsOverview({
      customer_type,
      search,
      dispatch_status,
      credit_compliance,
      owner_approval,
    });

    res.json({ leads });
  } catch (err: any) {
    console.error('Error fetching accounts leads:', err);
    res.status(500).json({ error: 'Failed to retrieve accounts leads.' });
  }
});

// 8. POST /api/accounts/leads/:leadId/clear-dispatch - Enforces B2C & B2B Hard Rules & Clears Dispatch
router.post('/leads/:leadId/clear-dispatch', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { leadId } = req.params;
    const { remarks } = req.body;

    const result = await AccountsService.clearProjectDispatch({
      lead_id: leadId,
      actor_id: user.id,
      actor_name: user.name,
      remarks,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error clearing dispatch:', err);
    res.status(400).json({ error: err.message || 'Failed to clear dispatch.' });
  }
});

// 9. POST /api/accounts/leads/:leadId/send-back-to-lead - Send back B2B case to Lead team user
router.post('/leads/:leadId/send-back-to-lead', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { leadId } = req.params;
    const { reason, remarks } = req.body;

    if (!reason || !remarks) {
      return res.status(400).json({ error: 'Reason and detailed remarks are required to send back to lead team.' });
    }

    const result = await AccountsService.sendBackB2BToLeadTeam({
      lead_id: leadId,
      actor_id: user.id,
      actor_name: user.name,
      reason,
      remarks,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error sending B2B case back to lead team:', err);
    res.status(400).json({ error: err.message || 'Failed to send back case to lead team.' });
  }
});

// 10. GET /api/accounts/leads/:leadId/financial-summary - Detailed receipts & follow-ups for a specific lead
router.get('/leads/:leadId/financial-summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId } = req.params;

    const [overviewList, receipts, followUps] = await Promise.all([
      AccountsService.getAccountsLeadsOverview(),
      AccountsService.getReceipts({ lead_id: leadId }),
      AccountsService.getFollowUps({ lead_id: leadId }),
    ]);

    const leadOverview = overviewList.find((l) => l.id === leadId);
    if (!leadOverview) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    res.json({
      lead: leadOverview,
      receipts,
      followUps,
    });
  } catch (err: any) {
    console.error('Error fetching financial summary:', err);
    res.status(500).json({ error: 'Failed to retrieve financial summary.' });
  }
});

export default router;
