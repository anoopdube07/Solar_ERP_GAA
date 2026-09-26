import express from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.ts';
import { ServiceComplaintService } from '../services/serviceComplaintService.ts';

const router = express.Router();

// 1. Get complaints list
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, priority, category, search, assignedToId } = req.query;
    const complaints = await ServiceComplaintService.getComplaints({
      status: status as string,
      priority: priority as string,
      category: category as string,
      search: search as string,
      assignedToId: assignedToId as string,
    });
    res.json({ complaints });
  } catch (err: any) {
    console.error('Error fetching complaints:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch complaints.' });
  }
});

// 2. Get service metrics summary
router.get('/metrics', requireAuth, async (_req: AuthenticatedRequest, res) => {
  try {
    const metrics = await ServiceComplaintService.getServiceMetrics();
    res.json({ metrics });
  } catch (err: any) {
    console.error('Error fetching service metrics:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch service metrics.' });
  }
});

// 3. Get single complaint with activities
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const complaint = await ServiceComplaintService.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint ticket not found.' });
    }
    res.json({ complaint });
  } catch (err: any) {
    console.error('Error fetching complaint details:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch complaint details.' });
  }
});

// 4. Register new complaint ticket
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const {
      lead_id,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      city,
      system_capacity_kw,
      inverter_brand_model,
      inverter_serial,
      commissioning_date,
      category,
      priority,
      title,
      description,
      reported_channel,
      assigned_to_user_id,
      assignment_notes,
    } = req.body;

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    if (!customer_phone || !customer_phone.trim()) {
      return res.status(400).json({ error: 'Customer phone number is required.' });
    }
    if (!category) {
      return res.status(400).json({ error: 'Complaint category is required.' });
    }
    if (!priority) {
      return res.status(400).json({ error: 'Priority is required.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Complaint subject/title is required.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Detailed description is required.' });
    }

    const complaint = await ServiceComplaintService.createComplaint(
      {
        lead_id,
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        city,
        system_capacity_kw,
        inverter_brand_model,
        inverter_serial,
        commissioning_date,
        category,
        priority,
        title,
        description,
        reported_channel,
        assigned_to_user_id,
        assignment_notes,
      },
      user
    );

    res.status(201).json({ success: true, complaint });
  } catch (err: any) {
    console.error('Error creating complaint:', err);
    res.status(500).json({ error: err.message || 'Failed to register complaint.' });
  }
});

// 5. Assign or reassign technician
router.post('/:id/assign', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { assigned_to_user_id, assignment_notes } = req.body;

    if (!assigned_to_user_id) {
      return res.status(400).json({ error: 'Technician user ID is required.' });
    }

    const complaint = await ServiceComplaintService.assignComplaint(
      req.params.id,
      assigned_to_user_id,
      assignment_notes,
      user
    );

    res.json({ success: true, complaint });
  } catch (err: any) {
    console.error('Error assigning complaint:', err);
    res.status(500).json({ error: err.message || 'Failed to assign technician.' });
  }
});

// 6. Update status, resolution notes, and workflow stage
router.post('/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const {
      status,
      technician_visit_date,
      root_cause,
      action_taken,
      parts_replaced,
      is_warranty_claim,
      warranty_claim_number,
      resolution_notes,
      customer_rating,
      customer_feedback,
      notes,
    } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const complaint = await ServiceComplaintService.updateStatus(
      req.params.id,
      {
        status,
        technician_visit_date,
        root_cause,
        action_taken,
        parts_replaced,
        is_warranty_claim,
        warranty_claim_number,
        resolution_notes,
        customer_rating,
        customer_feedback,
        notes,
      },
      user
    );

    res.json({ success: true, complaint });
  } catch (err: any) {
    console.error('Error updating complaint status:', err);
    res.status(500).json({ error: err.message || 'Failed to update complaint status.' });
  }
});

// 7. Add technical activity note
router.post('/:id/notes', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note text is required.' });
    }

    const activity = await ServiceComplaintService.addActivityNote(req.params.id, note, user);
    res.status(201).json({ success: true, activity });
  } catch (err: any) {
    console.error('Error adding activity note:', err);
    res.status(500).json({ error: err.message || 'Failed to add activity note.' });
  }
});

export default router;
