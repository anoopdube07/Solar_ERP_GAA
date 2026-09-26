import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDB } from '../db/index.ts';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.ts';
import { RegistrationService } from '../services/registrationService.ts';
import type {  InstallationMetrics, InstallationMemberWorkload, InstallationWorkQueueItem  } from '../../shared/types.ts';

const router = express.Router();

// Configure photo upload storage for physical installation
const instUploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'installation_photos');
if (!fs.existsSync(instUploadDir)) {
  fs.mkdirSync(instUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, instUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
  fileFilter: (_req, file, cb) => {
    const isImageMime = file.mimetype.startsWith('image/');
    const isImageExt = /\.(jpe?g|png|webp|heic|heif|bmp|tiff?)$/i.test(file.originalname);
    if (isImageMime || isImageExt) {
      cb(null, true);
    } else {
      cb(new Error(`File "${file.originalname}" is not a recognized image format. Please upload JPG, PNG, or WEBP.`));
    }
  },
});

// Safe Multer upload middleware wrapper: catches upload errors and outputs clean JSON (preventing HTML stack traces)
const handleInstallationPhotosUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  (upload.any() as any)(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'One or more photo files exceed the maximum allowed size of 25MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Error processing uploaded files.' });
    }
    next();
  });
};

// 1. GET /api/installation/metrics - Summary counters for Control Centre / Field Tech
router.get('/metrics', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const user = req.user!;

    // NEED-TO-KNOW SCOPING FOR INSTALLATION_MEMBER (Field Technician):
    // Members only see their own active and completed assignments, NOT company-wide pipeline or unassigned loads.
    if (user.role === 'INSTALLATION_MEMBER') {
      const svMemberRes = await db.query(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'ASSIGNED') as assigned_in_progress,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed
         FROM site_visits
         WHERE assigned_member_id = $1`,
        [user.id]
      );
      const svAssigned = Number(svMemberRes.rows[0]?.assigned_in_progress || 0);
      const svCompleted = Number(svMemberRes.rows[0]?.completed || 0);

      const ecpMemberRes = await db.query(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '5 days' AND status != 'LOST') as delayed
         FROM leads
         WHERE assigned_installer_id = $1
           AND (status = 'DOCUMENTATION_COMPLETE' OR current_team IN ('INSTALLATION_TEAM', 'INSTALLATION_MANAGER', 'REGISTRATION_1', 'REGISTRATION_TEAM'))
           AND (customer_type != 'B2C' OR dispatch_status = 'DELIVERED')`,
        [user.id]
      );
      const ecpTotal = Number(ecpMemberRes.rows[0]?.total || 0);
      const ecpDelayed = Number(ecpMemberRes.rows[0]?.delayed || 0);

      const actionRequiredTotal = svAssigned + ecpTotal;

      const memberMetrics: InstallationMetrics = {
        site_visits_waiting_assignment: 0, // Not relevant for technician
        site_visits_assigned_in_progress: svAssigned,
        site_visits_completed: svCompleted,
        installation_ecps_total: ecpTotal,
        installation_ecps_unassigned: 0, // Unassigned pool is manager-only
        installation_ecps_delayed: ecpDelayed,
        net_metering_pending_action: 0,
        action_required_total: actionRequiredTotal,
      };

      return res.json({ metrics: memberMetrics });
    }

    // MANAGERIAL METRICS (INSTALLATION_MANAGER, OWNER):
    // 1. Site Visit metrics
    const svRes = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'PENDING_ASSIGNMENT') as waiting_assignment,
        COUNT(*) FILTER (WHERE status = 'ASSIGNED') as assigned_in_progress,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed
      FROM site_visits
    `);
    const svWaiting = Number(svRes.rows[0]?.waiting_assignment || 0);
    const svAssigned = Number(svRes.rows[0]?.assigned_in_progress || 0);
    const svCompleted = Number(svRes.rows[0]?.completed || 0);

    // 2. ECP Installation projects metrics
    // For B2C leads: strictly only visible to installation manager once marked as dispatch complete (DELIVERED)
    const ecpRes = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE assigned_installer_id IS NULL) as unassigned,
        COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '5 days' AND status != 'LOST') as delayed
      FROM leads
      WHERE (status = 'DOCUMENTATION_COMPLETE'
         OR current_team IN ('INSTALLATION_TEAM', 'INSTALLATION_MANAGER', 'REGISTRATION_1', 'REGISTRATION_TEAM'))
         AND (customer_type != 'B2C' OR dispatch_status = 'DELIVERED')
    `);
    const ecpTotal = Number(ecpRes.rows[0]?.total || 0);
    const ecpUnassigned = Number(ecpRes.rows[0]?.unassigned || 0);
    const ecpDelayed = Number(ecpRes.rows[0]?.delayed || 0);

    // 3. Net Metering pending installation action
    const nmRes = await db.query(`
      SELECT COUNT(DISTINCT lead_id) as pending_action
      FROM registration_tasks
      WHERE stage = 'NET_METERING'
        AND owner_team = 'INSTALLATION'
        AND status = 'PENDING'
    `);
    const nmPendingAction = Number(nmRes.rows[0]?.pending_action || 0);

    // Action required total: Unassigned Site Visits + Unassigned ECPs + NM Pending Action + Delayed ECPs
    const actionRequiredTotal = svWaiting + ecpUnassigned + nmPendingAction + ecpDelayed;

    const metrics: InstallationMetrics = {
      site_visits_waiting_assignment: svWaiting,
      site_visits_assigned_in_progress: svAssigned,
      site_visits_completed: svCompleted,
      installation_ecps_total: ecpTotal,
      installation_ecps_unassigned: ecpUnassigned,
      installation_ecps_delayed: ecpDelayed,
      net_metering_pending_action: nmPendingAction,
      action_required_total: actionRequiredTotal,
    };

    res.json({ metrics });
  } catch (err: any) {
    console.error('Error fetching installation metrics:', err);
    res.status(500).json({ error: 'Failed to retrieve installation metrics.' });
  }
});

// 2. GET /api/installation/workload - Installation team capacity and active load (Manager / Owner ONLY)
router.get('/workload', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    // STRICT NEED-TO-KNOW: Field technicians do not have permission to view team workloads or peer capacity
    if (user.role !== 'INSTALLATION_MANAGER' && user.role !== 'OWNER') {
      return res.status(403).json({
        error: 'Access denied. Installation team workload and capacity overview is restricted to Installation Manager and Owner on a need-to-know basis.',
      });
    }

    const db = await getDB();

    // Fetch active installation personnel
    const usersRes = await db.query(`
      SELECT id, name, username, role, active
      FROM users
      WHERE role IN ('INSTALLATION_MEMBER', 'INSTALLATION_MANAGER')
        AND active = true
      ORDER BY role ASC, name ASC
    `);

    const workloadList: InstallationMemberWorkload[] = [];

    for (const member of usersRes.rows) {
      // 1. Active site visits assigned to this member
      const svCountRes = await db.query(`
        SELECT COUNT(*) as count
        FROM site_visits
        WHERE assigned_member_id = $1 AND status = 'ASSIGNED'
      `, [member.id]);
      const activeSv = Number(svCountRes.rows[0]?.count || 0);

      // 2. Active ECP installations assigned to this member
      const instCountRes = await db.query(`
        SELECT COUNT(*) as count
        FROM leads
        WHERE assigned_installer_id = $1
          AND status != 'LOST'
          AND (status = 'DOCUMENTATION_COMPLETE' OR current_team IN ('INSTALLATION_TEAM', 'INSTALLATION_MANAGER', 'REGISTRATION_1', 'REGISTRATION_TEAM'))
          AND (customer_type != 'B2C' OR dispatch_status = 'DELIVERED')
      `, [member.id]);
      const activeInst = Number(instCountRes.rows[0]?.count || 0);

      // 3. Delayed items
      const delayedSvRes = await db.query(`
        SELECT COUNT(*) as count
        FROM site_visits
        WHERE assigned_member_id = $1 
          AND status = 'ASSIGNED'
          AND updated_at < NOW() - INTERVAL '3 days'
      `, [member.id]);

      const delayedInstRes = await db.query(`
        SELECT COUNT(*) as count
        FROM leads
        WHERE assigned_installer_id = $1
          AND status != 'LOST'
          AND updated_at < NOW() - INTERVAL '5 days'
          AND (customer_type != 'B2C' OR dispatch_status = 'DELIVERED')
      `, [member.id]);

      const delayedTotal = Number(delayedSvRes.rows[0]?.count || 0) + Number(delayedInstRes.rows[0]?.count || 0);
      const totalActive = activeSv + activeInst;

      let availability: 'AVAILABLE' | 'MODERATE' | 'BUSY' = 'AVAILABLE';
      if (totalActive >= 5) {
        availability = 'BUSY';
      } else if (totalActive >= 2) {
        availability = 'MODERATE';
      }

      workloadList.push({
        user_id: member.id,
        name: member.name,
        username: member.username,
        role: member.role,
        active: member.active,
        active_site_visits: activeSv,
        active_installations: activeInst,
        delayed_items: delayedTotal,
        total_active: totalActive,
        availability,
      });
    }

    res.json({ workload: workloadList });
  } catch (err: any) {
    console.error('Error fetching installation workload:', err);
    res.status(500).json({ error: 'Failed to retrieve team workload.' });
  }
});

// 3. GET /api/installation/queue - Full operational work queue with high-fidelity items
router.get('/queue', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await getDB();
    const user = req.user!;
    const isTechnician = user.role === 'INSTALLATION_MEMBER';

    const { tab, assigned_user_id, search } = req.query as {
      tab?: string;
      assigned_user_id?: string;
      search?: string;
    };

    const queueItems: InstallationWorkQueueItem[] = [];

    // --- A. Lead-Stage Site Visits ---
    // If technician, strictly only load site visits assigned to them
    let svQuery = `
      SELECT sv.*,
             l.customer_name as lead_customer_name,
             l.mobile_number as lead_mobile_number,
             l.address as lead_address,
             l.location as lead_location,
             l.location_link as lead_location_link,
             cf_cap.value as lead_capacity_kwp,
             l.total_project_value as lead_total_project_value,
             l.lead_number,
             u_req.name as requesting_user_name,
             u_assigned.name as assigned_member_name,
             u_assigned_by.name as assigned_by_name,
             COALESCE(photo_agg.photo_count, 0)::int as photo_count
      FROM site_visits sv
      JOIN leads l ON sv.lead_id = l.id
      JOIN users u_req ON sv.requesting_user_id = u_req.id
      LEFT JOIN users u_assigned ON sv.assigned_member_id = u_assigned.id
      LEFT JOIN users u_assigned_by ON sv.assigned_by_id = u_assigned_by.id
      LEFT JOIN lead_custom_field_values cf_cap ON l.id = cf_cap.lead_id AND cf_cap.field_key = 'proposed_capacity_kw'
      LEFT JOIN (
        SELECT site_visit_id, COUNT(*) as photo_count
        FROM site_visit_photos
        GROUP BY site_visit_id
      ) photo_agg ON sv.id = photo_agg.site_visit_id
    `;

    const svQueryParams: any[] = [];
    if (isTechnician) {
      svQuery += ` WHERE sv.assigned_member_id = $1 `;
      svQueryParams.push(user.id);
    }
    svQuery += ` ORDER BY sv.created_at DESC `;

    const svRes = await db.query(svQuery, svQueryParams);
    for (const sv of svRes.rows) {
      const createdDate = new Date(sv.created_at);
      const daysInStage = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
      const isDelayed = sv.status !== 'COMPLETED' && daysInStage >= 3;

      let slaStatus: 'ON_TRACK' | 'AT_RISK' | 'DELAYED' = 'ON_TRACK';
      if (sv.status !== 'COMPLETED') {
        if (daysInStage >= 3) slaStatus = 'DELAYED';
        else if (daysInStage >= 2) slaStatus = 'AT_RISK';
      }

      let requirement = 'Awaiting installation member assignment';
      if (sv.status === 'ASSIGNED') {
        requirement = sv.scheduled_date 
          ? `Visit scheduled for ${new Date(sv.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Awaiting survey & photo upload.`
          : 'Awaiting survey execution & inspection photos';
      } else if (sv.status === 'COMPLETED') {
        requirement = `Survey completed (${sv.photo_count || 0} inspection photos verified)`;
      }

      // Technicians do not receive commercial contract totals on need-to-know basis
      const projectValue = isTechnician ? 0 : (Number(sv.lead_total_project_value) || 0);

      queueItems.push({
        id: `SV-${sv.id}`,
        lead_id: sv.lead_id,
        work_type: 'SITE_VISIT',
        customer_name: sv.lead_customer_name,
        lead_number: sv.lead_number,
        mobile_number: sv.lead_mobile_number,
        location: sv.lead_location || sv.lead_address,
        capacity_kwp: sv.lead_capacity_kwp ? Number(sv.lead_capacity_kwp) : null,
        total_project_value: projectValue,
        stage: 'Site Visit (Pre-feasibility)',
        current_status: sv.status,
        assigned_user_id: sv.assigned_member_id || null,
        assigned_user_name: sv.assigned_member_name || null,
        pending_requirement: requirement,
        days_in_stage: daysInStage,
        is_delayed: isDelayed,
        sla_status: slaStatus,
        has_mandatory_photos: Number(sv.photo_count) > 0,
        photos_count: Number(sv.photo_count) || 0,
        scheduled_date: sv.scheduled_date || null,
        updated_at: sv.updated_at,
        site_visit: sv,
        can_assign: !isTechnician && sv.status !== 'COMPLETED',
        can_complete: sv.status === 'ASSIGNED' && (isTechnician ? sv.assigned_member_id === user.id : true),
      });
    }

    // --- B. ECP Installation & Net Metering Projects ---
    let regLeads = await RegistrationService.getRegistrationLeads();

    // HARD WORKFLOW RULE: For B2C leads only, lead once qualified and moves to registration 1,
    // the lead must NOT be visible to installation team manager untill the project is marked
    // as dispatch complete from dispatch team (DELIVERED), then only it should be visible to
    // installation team manager user for assignment to installation team member users.
    regLeads = regLeads.filter(rl => rl.customer_type !== 'B2C' || rl.dispatch_status === 'DELIVERED');

    // If technician, strictly filter to ONLY leads assigned to this installer
    if (isTechnician) {
      regLeads = regLeads.filter(rl => rl.assigned_installer_id === user.id);
    }

    for (const rl of regLeads) {
      // Check tasks for this lead
      const tasks = await RegistrationService.getTasksForLead(rl.id);
      const reg1Tasks = tasks.filter(t => t.stage === 'REGISTRATION_1');
      const reg1Done = reg1Tasks.length > 0 && reg1Tasks.every(t => t.status === 'COMPLETED' || t.status === 'NOT_APPLICABLE');

      const instDetails = await RegistrationService.getInstallationDetails(rl.id);
      const isInstallationComplete = instDetails.is_completed;

      const requestNmTask = tasks.find(t => t.task_code === 'REQUEST_NET_METERING');
      const isRequestNmDone = requestNmTask?.status === 'COMPLETED';

      const closeNmTask = tasks.find(t => t.task_code === 'CLOSE_NET_METERING');
      const isCloseNmPending = closeNmTask && closeNmTask.status === 'PENDING';
      const isCloseNmDone = closeNmTask?.status === 'COMPLETED';

      let workType: 'INSTALLATION' | 'NET_METERING' = 'INSTALLATION';
      let pendingRequirement = rl.current_task_name || 'In progress';
      let canAssign = false;
      let canExecuteInstallation = false;
      let canCloseNetMetering = false;

      if (!reg1Done) {
        // Still in Registration 1
        workType = 'INSTALLATION';
        pendingRequirement = `Registration 1 in progress: ${rl.current_task_name}`;
        canAssign = !isTechnician; // Manager can pre-assign
      } else if (!isInstallationComplete) {
        // Registration 1 is finished, awaiting physical installation + 5 photos
        workType = 'INSTALLATION';
        canAssign = !isTechnician;
        if (!rl.assigned_installer_id) {
          pendingRequirement = 'ACTION REQUIRED: Assign Installation Crew Member to project for physical installation';
        } else {
          pendingRequirement = `Physical installation pending (${instDetails.photos_count}/5 photos uploaded). Assigned to ${rl.assigned_installer_name}`;
          canExecuteInstallation = true;
        }
      } else {
        // Physical installation is completed with 5 photos
        workType = 'NET_METERING';
        if (!isRequestNmDone) {
          pendingRequirement = `Physical installation verified (${instDetails.photos_count} photos). Registration team processing Net Metering (${rl.current_task_name || 'In progress'})`;
          canAssign = false;
        } else if (isCloseNmPending || (!isCloseNmDone && isRequestNmDone)) {
          // Ready for Close Net Metering by Installation Team!
          pendingRequirement = 'ACTION REQUIRED: Physical meter swap & grid sync (Close Net Metering)';
          canAssign = !isTechnician;
          canCloseNetMetering = true;
        } else if (isCloseNmDone) {
          pendingRequirement = 'Close Net Metering completed by Installation Team. Registration 2 in progress.';
        }
      }

      let slaStatus: 'ON_TRACK' | 'AT_RISK' | 'DELAYED' = 'ON_TRACK';
      if (rl.days_in_stage >= 5) slaStatus = 'DELAYED';
      else if (rl.days_in_stage >= 3) slaStatus = 'AT_RISK';

      // Redact commercial value for field technicians on need-to-know basis
      const projectValue = isTechnician ? 0 : (rl.total_project_value || 0);

      queueItems.push({
        id: `ECP-${rl.id}`,
        lead_id: rl.id,
        work_type: workType,
        customer_name: rl.customer_name,
        lead_number: rl.lead_number,
        mobile_number: rl.mobile_number,
        location: rl.location,
        capacity_kwp: rl.capacity_kwp,
        total_project_value: projectValue,
        stage: rl.stage === 'REGISTRATION_1' ? 'Registration 1' : rl.stage === 'NET_METERING' ? 'Net Metering (Meter & Grid Sync)' : 'Registration 2 (Asset Creation & Completion)',
        current_status: rl.overall_status,
        assigned_user_id: rl.assigned_installer_id || null,
        assigned_user_name: rl.assigned_installer_name || null,
        pending_requirement: pendingRequirement,
        days_in_stage: rl.days_in_stage,
        is_delayed: rl.is_delayed,
        sla_status: slaStatus,
        updated_at: rl.updated_at,
        registration_lead: rl,
        can_assign: canAssign,
        can_complete: canCloseNetMetering,
        can_execute_installation: canExecuteInstallation,
        can_close_net_metering: canCloseNetMetering,
        installation_record: instDetails.record,
        installation_photos: instDetails.photos,
        has_mandatory_photos: instDetails.has_all_photos,
        has_all_photos: instDetails.has_all_photos,
        photos_count: instDetails.photos_count,
        is_ready_for_close_net_metering: canCloseNetMetering,
      });
    }

    // --- Filtering Logic ---
    let filtered = queueItems;

    // 1. Tab filter
    if (tab === 'action_required') {
      filtered = filtered.filter(item => {
        if (item.work_type === 'SITE_VISIT') return item.current_status === 'PENDING_ASSIGNMENT' || item.is_delayed;
        if (item.work_type === 'NET_METERING') return item.can_close_net_metering;
        if (item.work_type === 'INSTALLATION') return !item.assigned_user_id || item.can_execute_installation || item.is_delayed;
        return false;
      });
    } else if (tab === 'site_visits') {
      filtered = filtered.filter(item => item.work_type === 'SITE_VISIT');
    } else if (tab === 'installations') {
      filtered = filtered.filter(item => item.work_type === 'INSTALLATION');
    } else if (tab === 'net_metering') {
      filtered = filtered.filter(item => item.work_type === 'NET_METERING');
    } else if (tab === 'delayed') {
      filtered = filtered.filter(item => item.is_delayed);
    } else if (tab === 'unassigned') {
      filtered = filtered.filter(item => !item.assigned_user_id);
    }

    // 2. Member filter
    if (assigned_user_id) {
      if (assigned_user_id === 'UNASSIGNED') {
        filtered = filtered.filter(item => !item.assigned_user_id);
      } else {
        filtered = filtered.filter(item => item.assigned_user_id === assigned_user_id);
      }
    }

    // 3. Search query
    if (search && search.trim().length > 0) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.customer_name.toLowerCase().includes(q) ||
        item.mobile_number.includes(q) ||
        item.lead_number.toString().includes(q) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.assigned_user_name && item.assigned_user_name.toLowerCase().includes(q))
      );
    }

    res.json({ items: filtered });
  } catch (err: any) {
    console.error('Error fetching installation queue:', err);
    res.status(500).json({ error: 'Failed to retrieve installation work queue.' });
  }
});

// 4. GET /api/installation/leads/:leadId/details - Installation details & photos for a lead
router.get('/leads/:leadId/details', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId } = req.params;
    const user = req.user!;
    const db = await getDB();

    // NEED-TO-KNOW CHECK: If user is INSTALLATION_MEMBER, verify assignment
    if (user.role === 'INSTALLATION_MEMBER') {
      const authRes = await db.query(
        `SELECT l.id FROM leads l
         LEFT JOIN site_visits sv ON sv.lead_id = l.id AND sv.assigned_member_id = $1
         WHERE l.id = $2 AND (l.assigned_installer_id = $1 OR sv.id IS NOT NULL)`,
        [user.id, leadId]
      );
      if (authRes.rows.length === 0) {
        return res.status(403).json({
          error: 'Access denied: You are not assigned to this installation or site visit.',
        });
      }
    }

    const details = await RegistrationService.getInstallationDetails(leadId);
    const tasks = await RegistrationService.getTasksForLead(leadId);
    res.json({ details, tasks });
  } catch (err: any) {
    console.error('Error getting installation details:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve installation details.' });
  }
});

// 5. POST /api/installation/leads/:leadId/assign - Assign or reassign installer (Manager / Owner ONLY)
router.post('/leads/:leadId/assign', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    if (user.role !== 'INSTALLATION_MANAGER' && user.role !== 'OWNER') {
      return res.status(403).json({
        error: 'Access denied. Only Installation Manager and Owner have authority to assign installation crew members.',
      });
    }

    const { leadId } = req.params;
    const { installer_id, remarks } = req.body;
    const db = await getDB();

    if (!installer_id) {
      return res.status(400).json({ error: 'installer_id is required.' });
    }

    // Verify installer user
    const instUserRes = await db.query(
      `SELECT id, name, role FROM users WHERE id = $1 AND role IN ('INSTALLATION_MEMBER', 'INSTALLATION_MANAGER', 'OWNER')`,
      [installer_id]
    );
    if (instUserRes.rows.length === 0) {
      return res.status(400).json({ error: 'Selected user is not an active installation team member.' });
    }
    const installer = instUserRes.rows[0];

    // Update lead
    await db.query(
      `UPDATE leads SET assigned_installer_id = $1, current_team = 'INSTALLATION_TEAM', updated_at = NOW() WHERE id = $2`,
      [installer_id, leadId]
    );

    // Upsert installation_records
    await db.query(
      `INSERT INTO installation_records (id, lead_id, assigned_installer_id, assigned_by_id, assigned_at, status, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), 'ASSIGNED', NOW())
       ON CONFLICT (lead_id) DO UPDATE
       SET assigned_installer_id = EXCLUDED.assigned_installer_id,
           assigned_by_id = EXCLUDED.assigned_by_id,
           assigned_at = EXCLUDED.assigned_at,
           status = CASE WHEN installation_records.status = 'COMPLETED' THEN installation_records.status ELSE 'ASSIGNED' END,
           updated_at = NOW()`,
      [crypto.randomUUID(), leadId, installer_id, req.user?.id]
    );

    // Record audit
    await db.query(
      `INSERT INTO lead_workflow_history (
        id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        crypto.randomUUID(),
        leadId,
        req.user?.id,
        req.user?.name,
        'INSTALLER_ASSIGNED',
        'UNASSIGNED',
        installer.name,
        remarks || `Assigned to installation crew member ${installer.name}.`,
      ]
    );

    const details = await RegistrationService.getInstallationDetails(leadId);
    res.json({ success: true, installer_name: installer.name, details });
  } catch (err: any) {
    console.error('Error assigning installer:', err);
    res.status(500).json({ error: err.message || 'Failed to assign installer.' });
  }
});

// 6. POST /api/installation/leads/:leadId/complete-installation - Upload 5 photos and mark physical installation complete
router.post(
  '/leads/:leadId/complete-installation',
  requireAuth,
  handleInstallationPhotosUpload,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { leadId } = req.params;
      const user = req.user!;
      const db = await getDB();

      // ROLE & NEED-TO-KNOW CHECK:
      const allowedRoles = ['INSTALLATION_MEMBER', 'INSTALLATION_MANAGER', 'OWNER'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: 'Access denied: Only installation field crew and managers can complete physical installations.',
        });
      }

      // If user is field technician, verify that the lead is assigned to THEM:
      if (user.role === 'INSTALLATION_MEMBER') {
        const leadRes = await db.query('SELECT assigned_installer_id FROM leads WHERE id = $1', [leadId]);
        if (leadRes.rows.length === 0) {
          return res.status(404).json({ error: 'Lead not found.' });
        }
        if (leadRes.rows[0].assigned_installer_id !== user.id) {
          return res.status(403).json({
            error: 'Access denied: You can only complete installations assigned directly to you on a need-to-know basis.',
          });
        }
      }

      const { inverter_serial_number, completion_remarks } = req.body;

      // Gather all uploaded files (handles both array and dictionary shapes from multer)
      const uploadedFiles: Express.Multer.File[] = Array.isArray(req.files)
        ? req.files
        : req.files
        ? Object.values(req.files).flat()
        : [];

      // Define mandatory photo map
      const photoCategories: { [key: string]: string } = {
        photo_inverter_serial: 'INVERTER_SERIAL',
        photo_inverter_with_customer: 'INVERTER_WITH_CUSTOMER',
        photo_panel_with_customer: 'PANEL_WITH_CUSTOMER',
        photo_lightning_arrester: 'LIGHTNING_ARRESTER',
        photo_earthing_pit: 'EARTHING_PIT',
      };

      const directCategories = new Set([
        'INVERTER_SERIAL',
        'INVERTER_WITH_CUSTOMER',
        'PANEL_WITH_CUSTOMER',
        'LIGHTNING_ARRESTER',
        'EARTHING_PIT',
      ]);

      // Save each uploaded file with proper schema columns
      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          const category =
            photoCategories[file.fieldname] ||
            (directCategories.has(file.fieldname) ? file.fieldname : null);

          if (category) {
            // Remove existing photo record and physical file for this category to allow clean updates
            const oldPhotos = await db.query(
              'SELECT id, file_path FROM installation_photos WHERE lead_id = $1 AND photo_category = $2',
              [leadId, category]
            );
            for (const old of oldPhotos.rows) {
              try {
                if (fs.existsSync(old.file_path)) {
                  fs.unlinkSync(old.file_path);
                }
              } catch {
                // Ignore unlink errors
              }
            }
            await db.query(
              'DELETE FROM installation_photos WHERE lead_id = $1 AND photo_category = $2',
              [leadId, category]
            );

            await db.query(
              `INSERT INTO installation_photos (
                id, lead_id, photo_category, file_path, original_name, mime_type, size_bytes, uploader_id, uploaded_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
              [
                crypto.randomUUID(),
                leadId,
                category,
                file.path,
                file.originalname,
                file.mimetype,
                file.size,
                req.user?.id,
              ]
            );
          }
        }
      }

      // Check current photos for this lead
      const details = await RegistrationService.getInstallationDetails(leadId);
      if (!details.has_all_photos) {
        return res.status(400).json({
          error: 'All 5 mandatory photos must be uploaded: Inverter Serial Number, Inverter alongside customer, Solar Panel alongside customer, Lightning Arrester, and Earthing Pit.',
          uploaded_photos: details.photos,
        });
      }

      // Update installation_records to COMPLETED
      await db.query(
        `INSERT INTO installation_records (
          id, lead_id, status, completed_at, completed_by, inverter_serial_number, completion_remarks, updated_at
        ) VALUES ($1, $2, 'COMPLETED', NOW(), $3, $4, $5, NOW())
        ON CONFLICT (lead_id) DO UPDATE
        SET status = 'COMPLETED',
            completed_at = NOW(),
            completed_by = EXCLUDED.completed_by,
            inverter_serial_number = COALESCE(EXCLUDED.inverter_serial_number, installation_records.inverter_serial_number),
            completion_remarks = COALESCE(EXCLUDED.completion_remarks, installation_records.completion_remarks),
            updated_at = NOW()`,
        [
          crypto.randomUUID(),
          leadId,
          req.user?.id,
          inverter_serial_number || null,
          completion_remarks || null,
        ]
      );

      // Record workflow audit
      await db.query(
        `INSERT INTO lead_workflow_history (
          id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          crypto.randomUUID(),
          leadId,
          req.user?.id,
          req.user?.name,
          'INSTALLATION_COMPLETED',
          'IN_PROGRESS',
          'COMPLETED',
          `Physical installation completed and 5 mandatory photos uploaded by ${req.user?.name}. Ready for Registration Team Net Metering.`,
        ]
      );

      const updatedDetails = await RegistrationService.getInstallationDetails(leadId);
      res.json({ success: true, details: updatedDetails });
    } catch (err: any) {
      console.error('Error completing installation:', err);
      res.status(500).json({ error: err.message || 'Failed to complete installation.' });
    }
  }
);

// 7. GET /api/installation/photos/:photoId - Secure photo streaming
router.get('/photos/:photoId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { photoId } = req.params;
    const db = await getDB();
    const photoRes = await db.query(
      `SELECT * FROM installation_photos WHERE id = $1`,
      [photoId]
    );
    if (photoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found.' });
    }
    const photo = photoRes.rows[0];

    if (!fs.existsSync(photo.file_path)) {
      return res.status(404).json({ error: 'Photo file not found on disk.' });
    }

    const filename = photo.original_name || photo.file_name || 'photo.jpg';
    res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    fs.createReadStream(photo.file_path).pipe(res);
  } catch (err: any) {
    console.error('Error streaming installation photo:', err);
    res.status(500).json({ error: 'Failed to stream photo.' });
  }
});

// 8. POST /api/installation/leads/:leadId/close-net-metering - Direct action for Close Net Metering
router.post('/leads/:leadId/close-net-metering', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId } = req.params;
    const { remarks } = req.body;
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await RegistrationService.completeTask(
      leadId,
      'CLOSE_NET_METERING',
      req.user,
      remarks
    );

    res.json({ success: true, result });
  } catch (err: any) {
    console.error('Error completing Close Net Metering:', err);
    res.status(400).json({ error: err.message || 'Failed to complete Close Net Metering.' });
  }
});

export default router;
