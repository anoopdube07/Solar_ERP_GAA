import express from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.ts';
import { RegistrationService } from '../services/registrationService.ts';

const router = express.Router();

// GET /api/registration/metrics
router.get('/metrics', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const metrics = await RegistrationService.getMetrics();
    res.json({ metrics });
  } catch (err: any) {
    console.error('Error fetching registration metrics:', err);
    res.status(500).json({ error: 'Failed to retrieve registration metrics.' });
  }
});

// GET /api/registration/leads
router.get('/leads', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const leads = await RegistrationService.getRegistrationLeads();
    res.json({ leads });
  } catch (err: any) {
    console.error('Error fetching registration leads:', err);
    res.status(500).json({ error: 'Failed to retrieve registration leads.' });
  }
});

// GET /api/registration/leads/:leadId/tasks
router.get('/leads/:leadId/tasks', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId } = req.params;
    const tasks = await RegistrationService.getTasksForLead(leadId);
    res.json({ tasks });
  } catch (err: any) {
    console.error('Error fetching tasks for lead:', err);
    res.status(500).json({ error: 'Failed to retrieve registration tasks.' });
  }
});

// POST /api/registration/leads/:leadId/tasks/:taskCode/complete
router.post('/leads/:leadId/tasks/:taskCode/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId, taskCode } = req.params;
    const { remarks } = req.body;
    const user = req.user!;

    const result = await RegistrationService.completeTask(leadId, taskCode, user, remarks);
    res.json({
      message: 'Task completed successfully.',
      task: result.task,
      stageAdvanced: result.stageAdvanced,
      newStage: result.newStage,
    });
  } catch (err: any) {
    console.error('Error completing registration task:', err);
    res.status(400).json({ error: err.message || 'Failed to complete registration task.' });
  }
});

// POST /api/registration/leads/:leadId/send-back-installation-photos
router.post('/leads/:leadId/send-back-installation-photos', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId } = req.params;
    const { target_role, remarks, rejected_categories } = req.body;
    const user = req.user!;

    if (!target_role || (target_role !== 'INSTALLATION_MANAGER' && target_role !== 'INSTALLATION_MEMBER')) {
      return res.status(400).json({
        error: 'target_role must be either INSTALLATION_MANAGER or INSTALLATION_MEMBER.',
      });
    }

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({
        error: 'Remarks describing the photo errors/corrections required are mandatory.',
      });
    }

    const result = await RegistrationService.sendBackInstallationPhotos({
      leadId,
      targetRole: target_role,
      remarks: remarks.trim(),
      user,
      rejectedCategories: rejected_categories,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error sending back installation photos:', err);
    res.status(400).json({ error: err.message || 'Failed to send back installation photos.' });
  }
});

export default router;
