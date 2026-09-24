import express from 'express';
import { DispatchService } from '../services/dispatchService.ts';

const router = express.Router();

/**
 * GET /api/dispatch/metrics
 * Get summary metrics for the dispatch module
 */
router.get('/metrics', async (req, res, next) => {
  try {
    const metrics = await DispatchService.getDispatchMetrics();
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dispatch/queue
 * Get projects in the dispatch queue
 */
router.get('/queue', async (req, res, next) => {
  try {
    const { status, customer_type, search } = req.query;
    const queue = await DispatchService.getDispatchQueue({
      status: status as string | undefined,
      customer_type: customer_type as string | undefined,
      search: search as string | undefined,
    });
    res.json(queue);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dispatch/handoff
 * Hand off a project to the Dispatch Team
 * Strictly enforces: For B2C project, at least one receipt >= Rs. 1 recorded by Accounts
 */
router.post('/handoff', async (req: any, res, next) => {
  try {
    const { lead_id, notes } = req.body;
    if (!lead_id) {
      return res.status(400).json({ error: 'Lead ID is required.' });
    }

    const actorId = req.user?.id || 'system';
    const actorName = req.user?.name || 'Dispatch System';

    const result = await DispatchService.handoffToDispatch({
      leadId: lead_id,
      actorId,
      actorName,
      notes,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to handoff project to Dispatch.' });
  }
});

/**
 * POST /api/dispatch/shipment
 * Update shipment logistics (transporter, LR, vehicle, driver) and mark as DISPATCHED
 */
router.post('/shipment', async (req: any, res, next) => {
  try {
    const {
      lead_id,
      transporter_name,
      lr_number,
      vehicle_number,
      driver_name,
      driver_phone,
      dispatch_date,
      estimated_delivery_date,
      dispatch_notes,
    } = req.body;

    if (!lead_id || !transporter_name || !lr_number || !vehicle_number || !dispatch_date) {
      return res.status(400).json({
        error: 'Lead ID, transporter name, LR number, vehicle number, and dispatch date are required.',
      });
    }

    const actorId = req.user?.id || 'system';
    const actorName = req.user?.name || 'Dispatch System';

    const result = await DispatchService.updateShipmentDetails({
      leadId: lead_id,
      transporter_name,
      lr_number,
      vehicle_number,
      driver_name,
      driver_phone,
      dispatch_date,
      estimated_delivery_date,
      dispatch_notes,
      actorId,
      actorName,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update shipment details.' });
  }
});

/**
 * POST /api/dispatch/deliver
 * Mark shipment delivered and handover to INSTALLATION TEAM
 */
router.post('/deliver', async (req: any, res, next) => {
  try {
    const {
      lead_id,
      actual_delivery_date,
      delivery_challan_number,
      delivery_notes,
      delivery_proof_url,
    } = req.body;

    if (!lead_id || !actual_delivery_date) {
      return res.status(400).json({
        error: 'Lead ID and actual delivery date are required.',
      });
    }

    const actorId = req.user?.id || 'system';
    const actorName = req.user?.name || 'Dispatch System';

    const result = await DispatchService.markDeliveredToSite({
      leadId: lead_id,
      actual_delivery_date,
      delivery_challan_number,
      delivery_notes,
      delivery_proof_url,
      actorId,
      actorName,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to mark delivery.' });
  }
});

/**
 * GET /api/dispatch/challan/:leadId
 * Fetch delivery challan & BOM data
 */
router.get('/challan/:leadId', async (req, res, next) => {
  try {
    const data = await DispatchService.getDeliveryChallanData(req.params.leadId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
