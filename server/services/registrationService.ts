import crypto from 'crypto';
import { getDB } from '../db/index.ts';
import type {
  RegistrationLeadItem,
  RegistrationMetrics,
  RegistrationStage,
  RegistrationTask,
  RegistrationTaskStatus,
  User,
} from '../../shared/types.ts';

interface TaskTemplate {
  stage: RegistrationStage;
  code: string;
  name: string;
  description: string;
  display_order: number;
  is_financing_dependent: boolean;
  owner_team: 'REGISTRATION' | 'INSTALLATION';
  depends_on?: string;
}

export const REGISTRATION_TASK_TEMPLATES: TaskTemplate[] = [
  // Stage 1: Registration 1
  {
    stage: 'REGISTRATION_1',
    code: 'CONSUMER_REQUEST',
    name: 'Consumer Request Submission',
    description: 'Online utility/DISCOM portal application filing and consumer number linking.',
    display_order: 1,
    is_financing_dependent: false,
    owner_team: 'REGISTRATION',
  },
  {
    stage: 'REGISTRATION_1',
    code: 'CVA_PRINT_SIGN',
    name: 'CVA Print & Sign',
    description: 'Consumer Verification Agreement generated, physically signed by consumer & uploaded.',
    display_order: 2,
    is_financing_dependent: false,
    owner_team: 'REGISTRATION',
    depends_on: 'CONSUMER_REQUEST',
  },
  {
    stage: 'REGISTRATION_1',
    code: 'FEASIBILITY_UPLOAD',
    name: 'Feasibility Report Upload',
    description: 'Technical feasibility approval report from DISCOM engineer received and uploaded.',
    display_order: 3,
    is_financing_dependent: false,
    owner_team: 'REGISTRATION',
    depends_on: 'CVA_PRINT_SIGN',
  },
  {
    stage: 'REGISTRATION_1',
    code: 'LOAN_DOCUMENTATION',
    name: 'Loan Documentation & KYC',
    description: 'Compile applicant bank statements, salary slips / ITR and loan application dossier.',
    display_order: 4,
    is_financing_dependent: true,
    owner_team: 'REGISTRATION',
  },
  {
    stage: 'REGISTRATION_1',
    code: 'LOAN_FILING',
    name: 'Loan Filing',
    description: 'Submit compiled credit dossier to partner bank / NBFC financing portal.',
    display_order: 5,
    is_financing_dependent: true,
    owner_team: 'REGISTRATION',
    depends_on: 'LOAN_DOCUMENTATION',
  },
  {
    stage: 'REGISTRATION_1',
    code: 'BANK_SUBMISSION',
    name: 'Bank Submission & Sanction',
    description: 'Bank field check verification completed and formal sanction letter received.',
    display_order: 6,
    is_financing_dependent: true,
    owner_team: 'REGISTRATION',
    depends_on: 'LOAN_FILING',
  },

  // Stage 2: Net Metering
  {
    stage: 'NET_METERING',
    code: 'INSTALLATION_PHOTOS',
    name: 'Upload Installation Photos',
    description: 'Verify rooftop solar array, inverter, earthing, structure & safety evidence photos.',
    display_order: 7,
    is_financing_dependent: false,
    owner_team: 'REGISTRATION',
  },
  {
    stage: 'NET_METERING',
    code: 'DCR_ISSUANCE',
    name: 'DCR Issuance',
    description: 'Domestic Content Requirement (DCR) certificate issuance and module serial validation.',
    display_order: 8,
    is_financing_dependent: false,
    owner_team: 'REGISTRATION',
    depends_on: 'INSTALLATION_PHOTOS',
  },
  {
    stage: 'NET_METERING',
    code: 'CONSUMER_APPROVAL',
    name: 'Consumer Approval & Submit',
    description: 'Consumer joint signature / OTP approval on net metering synchronization dossier.',
    display_order: 9,
    is_financing_dependent: false,
    owner_team: 'REGISTRATION',
    depends_on: 'DCR_ISSUANCE',
  },
  {
    stage: 'NET_METERING',
    code: 'REQUEST_NET_METERING',
    name: 'Request Net Metering',
    description: 'Formal submission to DISCOM division office for bi-directional meter release.',
    display_order: 10,
    is_financing_dependent: false,
    owner_team: 'REGISTRATION',
    depends_on: 'CONSUMER_APPROVAL',
  },
  {
    stage: 'NET_METERING',
    code: 'CLOSE_NET_METERING',
    name: 'Close Net Metering',
    description: 'Physical bi-directional meter installation, DISCOM sealing & grid synchronization. Owned by Installation Team.',
    display_order: 11,
    is_financing_dependent: false,
    owner_team: 'INSTALLATION',
    depends_on: 'REQUEST_NET_METERING',
  },

  // Stage 3: Registration 2
  {
    stage: 'REGISTRATION_2',
    code: 'ASSET_CREATION',
    name: 'Asset Creation',
    description: 'Portal asset creation, equipment serial linking, and installation validation.',
    display_order: 12,
    is_financing_dependent: false,
    owner_team: 'REGISTRATION',
    depends_on: 'CLOSE_NET_METERING',
  },
  {
    stage: 'REGISTRATION_2',
    code: 'COMPLETION_CERTIFICATE',
    name: 'Completion Certificate',
    description: 'Work completion certificate verified and signed off.',
    display_order: 13,
    is_financing_dependent: false,
    owner_team: 'REGISTRATION',
    depends_on: 'ASSET_CREATION',
  },
  {
    stage: 'REGISTRATION_2',
    code: 'BANK_FINAL_PAYMENT',
    name: 'Bank Submission for Final Payment',
    description: 'Submission of project completion certificate & dossier to lender for final loan disbursement.',
    display_order: 14,
    is_financing_dependent: true,
    owner_team: 'REGISTRATION',
    depends_on: 'COMPLETION_CERTIFICATE',
  },
];

export class RegistrationService {
  /**
   * Initializes or updates tasks for a specific lead based on its current financing & stage rules.
   */
  static async ensureTasksForLead(leadId: string): Promise<void> {
    const db = await getDB();

    const leadRes = await db.query(
      `SELECT id, b2c_loan_required, b2b_credit_extended, current_team, status, created_at, updated_at
       FROM leads WHERE id = $1`,
      [leadId]
    );

    if (leadRes.rows.length === 0) return;
    const lead = leadRes.rows[0];

    const isFinancing =
      lead.b2c_loan_required === 'YES' || lead.b2b_credit_extended === 'YES';

    // Migrate legacy Registration 2 task codes if present
    await db.query(
      `UPDATE registration_tasks 
       SET task_code = 'ASSET_CREATION', task_name = 'Asset Creation', description = 'Portal asset creation, equipment serial linking, and installation validation.'
       WHERE lead_id = $1 AND task_code = 'SUBSIDY_FILING'`,
      [leadId]
    );
    await db.query(
      `UPDATE registration_tasks 
       SET task_code = 'COMPLETION_CERTIFICATE', task_name = 'Completion Certificate', description = 'Work completion certificate verified and signed off.'
       WHERE lead_id = $1 AND task_code = 'COMMISSIONING_REPORT'`,
      [leadId]
    );
    await db.query(
      `UPDATE registration_tasks 
       SET task_code = 'BANK_FINAL_PAYMENT', task_name = 'Bank Submission for Final Payment', description = 'Submission of project completion certificate & dossier to lender for final loan disbursement.', is_financing_dependent = true
       WHERE lead_id = $1 AND task_code = 'SUBSIDY_DISBURSAL_TRACKING'`,
      [leadId]
    );

    // Check existing tasks
    const existingRes = await db.query(
      `SELECT task_code, status FROM registration_tasks WHERE lead_id = $1`,
      [leadId]
    );
    const existingMap = new Map<string, string>();
    for (const row of existingRes.rows) {
      existingMap.set(row.task_code, row.status);
    }

    for (const t of REGISTRATION_TASK_TEMPLATES) {
      const existingStatus = existingMap.get(t.code);

      if (!existingStatus) {
        let initialStatus: RegistrationTaskStatus = 'PENDING';
        if (t.is_financing_dependent && !isFinancing) {
          initialStatus = 'NOT_APPLICABLE';
        }

        const taskId = crypto.randomUUID();
        await db.query(
          `INSERT INTO registration_tasks (
            id, lead_id, stage, task_code, task_name, description, display_order,
            is_financing_dependent, owner_team, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            taskId,
            leadId,
            t.stage,
            t.code,
            t.name,
            t.description,
            t.display_order,
            t.is_financing_dependent,
            t.owner_team,
            initialStatus,
          ]
        );
      } else {
        // If task exists but financing status changed to NO, keep it marked NOT_APPLICABLE
        if (t.is_financing_dependent && !isFinancing && existingStatus !== 'NOT_APPLICABLE') {
          await db.query(
            `UPDATE registration_tasks SET status = 'NOT_APPLICABLE', updated_at = NOW()
             WHERE lead_id = $1 AND task_code = $2`,
            [leadId, t.code]
          );
        } else if (t.is_financing_dependent && isFinancing && existingStatus === 'NOT_APPLICABLE') {
          await db.query(
            `UPDATE registration_tasks SET status = 'PENDING', updated_at = NOW()
             WHERE lead_id = $1 AND task_code = $2`,
            [leadId, t.code]
          );
        }
      }
    }
  }

  /**
   * Evaluates and returns all tasks for a lead with resolved dependencies and actionable flags.
   */
  static async getTasksForLead(leadId: string): Promise<RegistrationTask[]> {
    const db = await getDB();
    await this.ensureTasksForLead(leadId);

    const res = await db.query(
      `SELECT rt.*, u.name as completed_by_name
       FROM registration_tasks rt
       LEFT JOIN users u ON rt.completed_by = u.id
       WHERE rt.lead_id = $1
       ORDER BY rt.display_order ASC`,
      [leadId]
    );

    const tasks: RegistrationTask[] = res.rows;
    const taskStatusMap = new Map<string, RegistrationTaskStatus>();
    for (const t of tasks) {
      taskStatusMap.set(t.task_code, t.status);
    }

    // Check if Registration 1 tasks are all completed
    const reg1Tasks = tasks.filter((t) => t.stage === 'REGISTRATION_1');
    const reg1Done = reg1Tasks.length > 0 && reg1Tasks.every(
      (t) => t.status === 'COMPLETED' || t.status === 'NOT_APPLICABLE'
    );

    // Query physical installation completion and 5 mandatory photos
    const instRes = await db.query(
      `SELECT ir.*,
              COUNT(DISTINCT ip.photo_category)::int as distinct_photos_count
       FROM installation_records ir
       LEFT JOIN installation_photos ip ON ir.lead_id = ip.lead_id
       WHERE ir.lead_id = $1
       GROUP BY ir.id`,
      [leadId]
    );
    const instRecord = instRes.rows[0];
    const isInstallationCompletedWith5Photos =
      instRecord &&
      instRecord.status === 'COMPLETED' &&
      Number(instRecord.distinct_photos_count) >= 5;

    // Attach dependencies, actionable flags, and blocking reasons
    return tasks.map((t) => {
      const template = REGISTRATION_TASK_TEMPLATES.find((tpl) => tpl.code === t.task_code);
      const dependsOn = template?.depends_on;
      const dependencies = dependsOn ? [dependsOn] : [];

      let status = t.status;
      let isActionable = false;
      let blockingReason: string | null = null;

      if (status === 'NOT_APPLICABLE') {
        blockingReason = 'Financing is not required for this project';
      } else if (status === 'COMPLETED') {
        isActionable = false;
      } else {
        // Stage-level gates & Installation handoff rules
        if (t.stage === 'NET_METERING' && !reg1Done) {
          status = 'BLOCKED';
          isActionable = false;
          blockingReason = 'Prerequisite pending: Complete all Registration 1 tasks';
        } else if (t.task_code === 'INSTALLATION_PHOTOS') {
          if (!isInstallationCompletedWith5Photos) {
            status = 'BLOCKED';
            isActionable = false;
            blockingReason = 'Awaiting physical installation and 5 mandatory photos from Installation Team.';
          } else {
            status = 'PENDING';
            isActionable = true;
            blockingReason = null;
          }
        } else if (dependsOn) {
          // Check standard task dependency
          const depStatus = taskStatusMap.get(dependsOn);
          if (depStatus !== 'COMPLETED' && depStatus !== 'NOT_APPLICABLE') {
            status = 'BLOCKED';
            const depTemplate = REGISTRATION_TASK_TEMPLATES.find((tpl) => tpl.code === dependsOn);
            blockingReason = `Prerequisite pending: ${depTemplate?.name || dependsOn}`;
          } else {
            status = 'PENDING';
            isActionable = true;
          }
        } else {
          status = 'PENDING';
          isActionable = true;
        }
      }

      return {
        ...t,
        status,
        dependencies,
        is_actionable: isActionable,
        blocking_reason: blockingReason,
      };
    });
  }

  /**
   * Completes a task for a lead, enforcing authoritative rules, RBAC, dependencies, and stage advancement.
   */
  static async completeTask(
    leadId: string,
    taskCode: string,
    user: User,
    remarks?: string
  ): Promise<{ task: RegistrationTask; stageAdvanced: boolean; newStage?: RegistrationStage }> {
    const db = await getDB();
    const tasks = await this.getTasksForLead(leadId);

    const task = tasks.find((t) => t.task_code === taskCode);
    if (!task) {
      throw new Error(`Task code '${taskCode}' not found for lead ${leadId}.`);
    }

    if (task.status === 'COMPLETED') {
      return { task, stageAdvanced: false };
    }

    if (task.status === 'NOT_APPLICABLE') {
      throw new Error(`Task '${task.task_name}' is not applicable for this project.`);
    }

    // Dependency check
    if (task.status === 'BLOCKED' || (task.blocking_reason && !task.is_actionable)) {
      throw new Error(`Cannot complete task: ${task.blocking_reason}`);
    }

    // Explicit check for INSTALLATION_PHOTOS
    if (taskCode === 'INSTALLATION_PHOTOS') {
      const instDetails = await this.getInstallationDetails(leadId);
      if (!instDetails.is_completed) {
        throw new Error(
          'Cannot complete task: Physical installation must be completed and all 5 mandatory photos (Inverter S/N, Inverter w/ customer, Panel w/ customer, Lightning Arrester, Earthing Pit) must be uploaded by the Installation Team first.'
        );
      }
    }

    // Role Ownership check
    if (task.owner_team === 'INSTALLATION') {
      const allowedRoles = ['INSTALLATION_MANAGER', 'INSTALLATION_MEMBER', 'OWNER'];
      if (!allowedRoles.includes(user.role)) {
        throw new Error(
          `Access Denied: '${task.task_name}' is strictly owned and physically executed on-site by the Installation Team.`
        );
      }
    } else if (task.owner_team === 'REGISTRATION') {
      const allowedRoles = ['REGISTRATION', 'OWNER', 'MANAGER'];
      if (!allowedRoles.includes(user.role)) {
        throw new Error(
          `Access Denied: '${task.task_name}' is assigned to the Registration Team.`
        );
      }
    }

    // Update the task to COMPLETED
    await db.query(
      `UPDATE registration_tasks
       SET status = 'COMPLETED',
           completed_by = $1,
           completed_at = NOW(),
           remarks = $2,
           updated_at = NOW()
       WHERE lead_id = $3 AND task_code = $4`,
      [user.id, remarks || null, leadId, taskCode]
    );

    // Record workflow history for auditability
    try {
      await db.query(
        `INSERT INTO lead_workflow_history (
          id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          crypto.randomUUID(),
          leadId,
          user.id,
          user.name,
          'REGISTRATION_TASK_COMPLETED',
          task.stage,
          taskCode,
          `Task completed: ${task.task_name}. ${remarks ? `Remarks: ${remarks}` : ''}`,
        ]
      );
    } catch (e) {
      console.warn('Failed to record workflow audit item:', e);
    }

    // Specific intermediate workflow handoff: REQUEST_NET_METERING completed
    if (taskCode === 'REQUEST_NET_METERING') {
      await db.query(
        `UPDATE leads SET current_team = 'INSTALLATION_MANAGER', updated_at = NOW() WHERE id = $1`,
        [leadId]
      );
      try {
        await db.query(
          `INSERT INTO lead_workflow_history (
            id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            crypto.randomUUID(),
            leadId,
            user.id,
            user.name,
            'TEAM_HANDOFF',
            'REGISTRATION_TEAM',
            'INSTALLATION_MANAGER',
            'Registration team completed Net Metering filing. Transferred to Installation Team Manager for assignment/reassignment to complete Close Net Metering.',
          ]
        );
      } catch (e) {
        console.warn('Failed to record team handoff history:', e);
      }
    }

    // Specific intermediate workflow handoff: CLOSE_NET_METERING completed
    if (taskCode === 'CLOSE_NET_METERING') {
      await db.query(
        `UPDATE leads SET current_team = 'REGISTRATION_TEAM', updated_at = NOW() WHERE id = $1`,
        [leadId]
      );
      try {
        await db.query(
          `INSERT INTO lead_workflow_history (
            id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            crypto.randomUUID(),
            leadId,
            user.id,
            user.name,
            'TEAM_HANDOFF',
            'INSTALLATION_TEAM',
            'REGISTRATION_TEAM',
            'Close Net Metering executed by Installation Team. Handed over to Registration Team to start Registration 2 process.',
          ]
        );
      } catch (e) {
        console.warn('Failed to record team handoff history:', e);
      }
    }

    // Check if current stage can be advanced
    const updatedTasks = await this.getTasksForLead(leadId);
    const stageTasks = updatedTasks.filter((t) => t.stage === task.stage);
    const allStageTasksDone = stageTasks.every(
      (t) => t.status === 'COMPLETED' || t.status === 'NOT_APPLICABLE'
    );

    let stageAdvanced = false;
    let newStage: RegistrationStage | undefined;

    if (allStageTasksDone) {
      if (task.stage === 'REGISTRATION_1') {
        newStage = 'NET_METERING';
        stageAdvanced = true;

        // When Registration 1 completes, Lead moves to Installation Team Manager for assignment/reassignment
        await db.query(
          `UPDATE leads SET current_team = 'INSTALLATION_MANAGER', updated_at = NOW() WHERE id = $1`,
          [leadId]
        );

        // Ensure installation_records entry exists
        await db.query(
          `INSERT INTO installation_records (id, lead_id, status, assigned_installer_id, created_at, updated_at)
           SELECT $1, l.id, CASE WHEN l.assigned_installer_id IS NOT NULL THEN 'ASSIGNED' ELSE 'PENDING_ASSIGNMENT' END, l.assigned_installer_id, NOW(), NOW()
           FROM leads l
           WHERE l.id = $2
           ON CONFLICT (lead_id) DO NOTHING`,
          [crypto.randomUUID(), leadId]
        );

        try {
          await db.query(
            `INSERT INTO lead_workflow_history (
              id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              crypto.randomUUID(),
              leadId,
              user.id,
              user.name,
              'TEAM_HANDOFF',
              'REGISTRATION_1',
              'INSTALLATION_MANAGER',
              'Registration 1 completed. Lead transferred to Installation Team Manager for assignment/reassignment to Installation team member for physical installation.',
            ]
          );
        } catch (e) {
          console.warn('Failed to record team handoff history:', e);
        }
      } else if (task.stage === 'NET_METERING') {
        newStage = 'REGISTRATION_2';
        stageAdvanced = true;
      } else if (task.stage === 'REGISTRATION_2') {
        stageAdvanced = true;
      }

      if (stageAdvanced && newStage) {
        // Record stage advancement
        try {
          await db.query(
            `INSERT INTO lead_workflow_history (
              id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              crypto.randomUUID(),
              leadId,
              user.id,
              user.name,
              'REGISTRATION_STAGE_ADVANCED',
              task.stage,
              newStage,
              `Advanced from ${task.stage} to ${newStage} upon completing all stage prerequisites.`,
            ]
          );
        } catch (e) {
          console.warn('Failed to record stage advance history:', e);
        }
      }
    }

    const completedTask = updatedTasks.find((t) => t.task_code === taskCode)!;
    return { task: completedTask, stageAdvanced, newStage };
  }

  /**
   * Retrieves complete installation execution status and photos for a lead.
   */
  static async getInstallationDetails(leadId: string) {
    const db = await getDB();
    const recRes = await db.query(
      `SELECT ir.*,
              u_inst.name as assigned_installer_name,
              u_by.name as assigned_by_name,
              u_comp.name as completed_by_name
       FROM installation_records ir
       LEFT JOIN users u_inst ON ir.assigned_installer_id = u_inst.id
       LEFT JOIN users u_by ON ir.assigned_by_id = u_by.id
       LEFT JOIN users u_comp ON ir.completed_by = u_comp.id
       WHERE ir.lead_id = $1`,
      [leadId]
    );

    const photosRes = await db.query(
      `SELECT ip.*, u.name as uploader_name
       FROM installation_photos ip
       LEFT JOIN users u ON ip.uploader_id = u.id
       WHERE ip.lead_id = $1
       ORDER BY ip.uploaded_at ASC`,
      [leadId]
    );

    const photos = photosRes.rows;
    const record = recRes.rows[0] || null;
    const categoriesPresent = new Set(photos.map((p: any) => p.photo_category));
    const hasAll5Photos =
      categoriesPresent.has('INVERTER_SERIAL') &&
      categoriesPresent.has('INVERTER_WITH_CUSTOMER') &&
      categoriesPresent.has('PANEL_WITH_CUSTOMER') &&
      categoriesPresent.has('LIGHTNING_ARRESTER') &&
      categoriesPresent.has('EARTHING_PIT');

    return {
      record,
      photos,
      photos_count: photos.length,
      has_all_photos: hasAll5Photos,
      is_completed: record?.status === 'COMPLETED' && hasAll5Photos,
    };
  }

  /**
   * Retrieves all Registration leads formatted with computed stage, active task, days in stage, and delayed status.
   */
  static async getRegistrationLeads(): Promise<RegistrationLeadItem[]> {
    const db = await getDB();

    // Query leads that are in Registration stages or documentation complete
    const query = `
      SELECT l.*,
             cf_cap.value as capacity_kwp,
             u_owner.name as owner_name,
             u_creator.name as creator_name,
             u_installer.name as assigned_installer_name
      FROM leads l
      JOIN users u_owner ON l.owner_id = u_owner.id
      JOIN users u_creator ON l.created_by = u_creator.id
      LEFT JOIN users u_installer ON l.assigned_installer_id = u_installer.id
      LEFT JOIN lead_custom_field_values cf_cap ON l.id = cf_cap.lead_id AND cf_cap.field_key = 'proposed_capacity_kw'
      WHERE (
        l.current_team IN ('REGISTRATION_1', 'REGISTRATION_TEAM') OR
        l.status = 'DOCUMENTATION_COMPLETE' OR
        l.id IN (SELECT DISTINCT lead_id FROM registration_tasks)
      )
      ORDER BY l.created_at DESC
    `;

    const res = await db.query(query);
    const leads = res.rows;

    const items: RegistrationLeadItem[] = [];

    for (const lead of leads) {
      const tasks = await this.getTasksForLead(lead.id);

      // Determine current stage based on completed tasks
      const reg1Tasks = tasks.filter((t) => t.stage === 'REGISTRATION_1');
      const reg1Done = reg1Tasks.every(
        (t) => t.status === 'COMPLETED' || t.status === 'NOT_APPLICABLE'
      );

      const netTasks = tasks.filter((t) => t.stage === 'NET_METERING');
      const netDone = netTasks.every(
        (t) => t.status === 'COMPLETED' || t.status === 'NOT_APPLICABLE'
      );

      const reg2Tasks = tasks.filter((t) => t.stage === 'REGISTRATION_2');
      const reg2Done = reg2Tasks.every(
        (t) => t.status === 'COMPLETED' || t.status === 'NOT_APPLICABLE'
      );

      let currentStage: RegistrationStage = 'REGISTRATION_1';
      if (reg1Done && !netDone) {
        currentStage = 'NET_METERING';
      } else if (reg1Done && netDone) {
        currentStage = 'REGISTRATION_2';
      }

      // Find current active task in the current stage
      const currentStageTasks = tasks.filter((t) => t.stage === currentStage);
      const pendingTask =
        currentStageTasks.find((t) => t.status === 'PENDING') ||
        currentStageTasks.find((t) => t.status === 'BLOCKED') ||
        currentStageTasks.find((t) => t.status !== 'COMPLETED' && t.status !== 'NOT_APPLICABLE');

      // Calculate days in stage (from updated_at or created_at)
      const referenceDate = new Date(lead.updated_at || lead.created_at);
      const diffMs = Date.now() - referenceDate.getTime();
      const daysInStage = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      // Delayed threshold: > 5 days in stage
      const isDelayed = !reg2Done && daysInStage >= 5;

      const financingRequired =
        lead.b2c_loan_required === 'YES' || lead.b2b_credit_extended === 'YES';

      const totalTasksCount = tasks.filter((t) => t.status !== 'NOT_APPLICABLE').length;
      const completedTasksCount = tasks.filter((t) => t.status === 'COMPLETED').length;
      const activeTasksCount = totalTasksCount - completedTasksCount;

      let overallStatus: 'ACTIONABLE' | 'PENDING' | 'BLOCKED' | 'COMPLETED' = 'PENDING';
      if (reg2Done) {
        overallStatus = 'COMPLETED';
      } else if (pendingTask?.is_actionable) {
        overallStatus = 'ACTIONABLE';
      } else if (pendingTask?.status === 'BLOCKED') {
        overallStatus = 'BLOCKED';
      }

      items.push({
        id: lead.id,
        lead_number: lead.lead_number,
        customer_name: lead.customer_name,
        customer_type: lead.customer_type,
        mobile_number: lead.mobile_number,
        location: lead.location || lead.address,
        capacity_kwp: lead.capacity_kwp || null,
        total_project_value: Number(lead.total_project_value) || 0,
        stage: currentStage,
        current_team: lead.current_team,
        dispatch_status: lead.dispatch_status,
        assigned_installer_id: lead.assigned_installer_id || null,
        assigned_installer_name: lead.assigned_installer_name || null,
        financing_required: financingRequired,
        b2c_loan_required: lead.b2c_loan_required,
        b2b_credit_extended: lead.b2b_credit_extended,
        days_in_stage: daysInStage,
        is_delayed: isDelayed,
        current_task_code: pendingTask ? pendingTask.task_code : null,
        current_task_name: pendingTask ? pendingTask.task_name : reg2Done ? 'All Registration Completed' : 'All Stage Tasks Done',
        current_task_status: pendingTask ? pendingTask.status : reg2Done ? 'COMPLETED' : null,
        active_tasks_count: activeTasksCount,
        completed_tasks_count: completedTasksCount,
        total_tasks_count: totalTasksCount,
        overall_status: overallStatus,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      });
    }

    return items;
  }

  /**
   * Retrieves summary metrics for the Registration Team dashboard cards.
   */
  static async getMetrics(): Promise<RegistrationMetrics> {
    const leads = await this.getRegistrationLeads();

    let reg1_pending = 0;
    let net_metering_pending = 0;
    let reg2_pending = 0;
    let delayed_count = 0;
    let completed_count = 0;

    for (const l of leads) {
      if (l.overall_status === 'COMPLETED') {
        completed_count++;
      } else {
        if (l.stage === 'REGISTRATION_1') reg1_pending++;
        else if (l.stage === 'NET_METERING') net_metering_pending++;
        else if (l.stage === 'REGISTRATION_2') reg2_pending++;

        if (l.is_delayed) delayed_count++;
      }
    }

    const total_pending = reg1_pending + net_metering_pending + reg2_pending;

    return {
      reg1_pending,
      net_metering_pending,
      reg2_pending,
      total_pending,
      delayed_count,
      completed_count,
    };
  }

  /**
   * Send back project / installation photos to Installation Team (Manager or Field Crew)
   * for uploading correct photos in case of any error.
   */
  static async sendBackInstallationPhotos(params: {
    leadId: string;
    targetRole: 'INSTALLATION_MANAGER' | 'INSTALLATION_MEMBER';
    remarks: string;
    user: User;
    rejectedCategories?: string[];
  }) {
    const db = await getDB();
    const { leadId, targetRole, remarks, user, rejectedCategories } = params;

    const leadRes = await db.query('SELECT * FROM leads WHERE id = $1', [leadId]);
    if (leadRes.rows.length === 0) {
      throw new Error('Lead not found.');
    }
    const lead = leadRes.rows[0];

    const nextTeam = targetRole === 'INSTALLATION_MANAGER' ? 'INSTALLATION_MANAGER' : 'INSTALLATION_TEAM';

    // 1. Update lead current_team & action_required
    await db.query(
      `UPDATE leads 
       SET current_team = $1, 
           action_required = true, 
           updated_at = NOW() 
       WHERE id = $2`,
      [nextTeam, leadId]
    );

    // 2. Update installation_records to indicate revision required
    await db.query(
      `UPDATE installation_records
       SET status = 'NEEDS_REVISION',
           completion_remarks = CONCAT(COALESCE(completion_remarks, ''), E'\n[REVISION REQUESTED BY REGISTRATION]: ', $1),
           updated_at = NOW()
       WHERE lead_id = $2`,
      [remarks, leadId]
    );

    // 3. Reset the INSTALLATION_PHOTOS task in registration_tasks to PENDING (with remarks)
    await db.query(
      `UPDATE registration_tasks
       SET status = 'PENDING',
           remarks = $1,
           completed_at = NULL,
           completed_by = NULL,
           updated_at = NOW()
       WHERE lead_id = $2 AND task_code = 'INSTALLATION_PHOTOS'`,
      [`Sent back to ${targetRole === 'INSTALLATION_MANAGER' ? 'Installation Manager' : 'Field Crew'}: ${remarks}`, leadId]
    );

    // 4. If specific categories were rejected, remove them so they must be re-uploaded; or if all, remove
    if (rejectedCategories && rejectedCategories.length > 0) {
      for (const cat of rejectedCategories) {
        await db.query(
          `DELETE FROM installation_photos WHERE lead_id = $1 AND photo_category = $2`,
          [leadId, cat]
        );
      }
    }

    // 5. Record workflow audit trail
    await db.query(
      `INSERT INTO lead_workflow_history (
        id, lead_id, actor_id, actor_name, event_type, previous_state, new_state, remarks, metadata_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        crypto.randomUUID(),
        leadId,
        user.id,
        user.name,
        'INSTALLATION_PHOTOS_REJECTED',
        'REGISTRATION_TEAM',
        nextTeam,
        `Photos rejected by Registration Team: ${remarks}. Sent back to ${targetRole === 'INSTALLATION_MANAGER' ? 'Installation Team Manager' : 'Field Crew Technician'}.`,
        JSON.stringify({
          target_role: targetRole,
          target_team: nextTeam,
          remarks,
          rejected_categories: rejectedCategories || [],
        }),
      ]
    );

    return {
      success: true,
      message: `Project successfully sent back to ${targetRole === 'INSTALLATION_MANAGER' ? 'Installation Team Manager' : 'Installation Field Crew'} for photo corrections.`,
      lead_id: leadId,
      next_team: nextTeam,
    };
  }
}
