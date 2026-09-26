import fs from 'fs';
import path from 'path';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';

export interface DBClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
  transaction: <T>(callback: (tx: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }> }) => Promise<T>) => Promise<T>;
}

let dbInstance: DBClient | null = null;

export async function getDB(): Promise<DBClient> {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    console.log('[DB] Connecting to external PostgreSQL via pg.Pool...');
    const pool = new pg.Pool({ connectionString: databaseUrl });
    dbInstance = {
      query: async (text: string, params?: unknown[]) => {
        const res = await pool.query(text, params as any[]);
        return { rows: res.rows, rowCount: res.rowCount ?? 0 };
      },
      transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await callback({
            query: async (text: string, params?: unknown[]) => {
              const res = await client.query(text, params as any[]);
              return { rows: res.rows, rowCount: res.rowCount ?? 0 };
            },
          });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
    };
  } else {
    console.log('[DB] Initializing embedded persistent PostgreSQL (PGlite)...');
    let dataDir = path.resolve(process.cwd(), 'data', 'solar_erp_pgdata');
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (_dirErr) {
      console.warn('[DB] Could not create local data dir, falling back to /tmp...');
      dataDir = path.resolve('/tmp', 'solar_erp_pgdata');
      try {
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
      } catch (_tmpErr) {}
    }

    let pglite: PGlite;
    try {
      const pidFile = path.join(dataDir, 'postmaster.pid');
      if (fs.existsSync(pidFile)) {
        try {
          fs.unlinkSync(pidFile);
        } catch (_) {}
      }
      pglite = new PGlite(dataDir);
      await pglite.query('SELECT 1');
    } catch (err) {
      console.warn('[DB] Persistent PGlite initialization encountered an issue, recreating fresh database directory...', err);
      try {
        if (fs.existsSync(dataDir)) {
          fs.rmSync(dataDir, { recursive: true, force: true });
        }
        fs.mkdirSync(dataDir, { recursive: true });
        pglite = new PGlite(dataDir);
        await pglite.query('SELECT 1');
      } catch (fallbackErr) {
        console.warn('[DB] Falling back to in-memory PGlite instance:', fallbackErr);
        pglite = new PGlite();
        await pglite.query('SELECT 1');
      }
    }

    // Gracefully close on exit to avoid leaving lock files
    const cleanClose = async () => {
      try {
        await pglite.close();
      } catch (_) {}
    };
    process.once('SIGINT', cleanClose);
    process.once('SIGTERM', cleanClose);

    dbInstance = {
      query: async (text: string, params?: unknown[]) => {
        const res = await pglite.query(text, params as any[]);
        return { rows: res.rows as any[], rowCount: res.rows?.length ?? 0 };
      },
      transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
        return await pglite.transaction(async (tx) => {
          return await callback({
            query: async (text: string, params?: unknown[]) => {
              const res = await tx.query(text, params as any[]);
              return { rows: res.rows as any[], rowCount: res.rows?.length ?? 0 };
            },
          });
        });
      },
    };
  }

  // Run schema initialization
  await initSchema(dbInstance);

  return dbInstance;
}

async function initSchema(db: DBClient) {
  try {
    const schemaPath = path.resolve(process.cwd(), 'server', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      // Split statements on semicolons while respecting line endings
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await db.query(statement);
      }

      // Run incremental column migrations for existing instances
      try {
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS documentation_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE'`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check`);
        await db.query(`ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN ('PENDING', 'SITE_VISIT_PENDING', 'ESCALATED_TO_OWNER', 'OWNER_CREDIT_APPROVAL', 'QUALIFIED', 'DOCUMENTATION_COMPLETE', 'LOST'))`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_current_team_check`);
        await db.query(`ALTER TABLE leads ADD CONSTRAINT leads_current_team_check CHECK (current_team IN ('LEAD', 'INSTALLATION_MANAGER', 'INSTALLATION_TEAM', 'OWNER', 'REGISTRATION_1', 'REGISTRATION_TEAM', 'ECP_PLACEHOLDER', 'ACCOUNTS', 'ACCOUNTS_PLACEHOLDER', 'DISPATCH', 'DISPATCH_TEAM'))`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`ALTER TABLE lead_documents ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW()`);
        await db.query(`UPDATE lead_documents SET uploaded_at = created_at WHERE uploaded_at IS NULL`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
        await db.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('OWNER', 'MANAGER', 'LEAD', 'INSTALLATION_MANAGER', 'INSTALLATION_MEMBER', 'REGISTRATION', 'ACCOUNTS', 'DISPATCH', 'SERVICE'))`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`ALTER TABLE installation_records DROP CONSTRAINT IF EXISTS installation_records_status_check`);
        await db.query(`ALTER TABLE installation_records ADD CONSTRAINT installation_records_status_check CHECK (status IN ('PENDING_ASSIGNMENT', 'ASSIGNED', 'COMPLETED', 'NEEDS_REVISION'))`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS registration_tasks (
            id TEXT PRIMARY KEY,
            lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            stage TEXT NOT NULL CHECK (stage IN ('REGISTRATION_1', 'NET_METERING', 'REGISTRATION_2')),
            task_code TEXT NOT NULL,
            task_name TEXT NOT NULL,
            description TEXT,
            display_order INTEGER NOT NULL DEFAULT 0,
            is_financing_dependent BOOLEAN NOT NULL DEFAULT false,
            owner_team TEXT NOT NULL DEFAULT 'REGISTRATION' CHECK (owner_team IN ('REGISTRATION', 'INSTALLATION')),
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'BLOCKED', 'NOT_APPLICABLE')),
            completed_by TEXT REFERENCES users(id),
            completed_at TIMESTAMPTZ,
            remarks TEXT,
            metadata_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_tasks_lead_code ON registration_tasks(lead_id, task_code)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_reg_tasks_lead ON registration_tasks(lead_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_reg_tasks_stage_status ON registration_tasks(stage, status)`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_custom_values_unique ON lead_custom_field_values(lead_id, field_definition_id)`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_installer_id TEXT REFERENCES users(id)`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMPTZ`);
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS structure_height TEXT`);
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS earthing_cable_length TEXT`);
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS dc_cable_length TEXT`);
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS ac_cable_length TEXT`);
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS geo_latitude NUMERIC(10, 7)`);
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS geo_longitude NUMERIC(10, 7)`);
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS geo_address TEXT`);
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS photo_captured_with_owner BOOLEAN DEFAULT true`);
        await db.query(`ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS extra_materials_json TEXT`);
        await db.query(`ALTER TABLE site_visit_photos ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7)`);
        await db.query(`ALTER TABLE site_visit_photos ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7)`);
        await db.query(`ALTER TABLE site_visit_photos ADD COLUMN IF NOT EXISTS is_with_owner BOOLEAN DEFAULT true`);
      } catch (e) {
        // Safe ignore
      }
      try {
        await db.query(`ALTER TABLE escalations ADD COLUMN IF NOT EXISTS owner_remarks TEXT`);
        await db.query(`ALTER TABLE escalations ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ`);
      } catch (e) {
        // Safe ignore
      }
      try {
        // Migrate Registration 2 task codes to new workflow
        await db.query(`
          UPDATE registration_tasks 
          SET task_code = 'ASSET_CREATION', task_name = 'Asset Creation', description = 'Portal asset creation, equipment serial linking, and installation validation.'
          WHERE task_code = 'SUBSIDY_FILING'
        `);
        await db.query(`
          UPDATE registration_tasks 
          SET task_code = 'COMPLETION_CERTIFICATE', task_name = 'Completion Certificate', description = 'Work completion certificate verified and signed off.'
          WHERE task_code = 'COMMISSIONING_REPORT'
        `);
        await db.query(`
          UPDATE registration_tasks 
          SET task_code = 'BANK_FINAL_PAYMENT', task_name = 'Bank Submission for Final Payment', description = 'Submission of project completion certificate & dossier to lender for final loan disbursement.', is_financing_dependent = true
          WHERE task_code = 'SUBSIDY_DISBURSAL_TRACKING'
        `);
        // If loan is not YES, set BANK_FINAL_PAYMENT to NOT_APPLICABLE
        await db.query(`
          UPDATE registration_tasks rt
          SET status = 'NOT_APPLICABLE', is_financing_dependent = true
          FROM leads l
          WHERE rt.lead_id = l.id
            AND rt.task_code = 'BANK_FINAL_PAYMENT'
            AND COALESCE(l.b2c_loan_required, 'NO') != 'YES'
            AND COALESCE(l.b2b_credit_extended, 'NO') != 'YES'
            AND rt.status != 'COMPLETED'
        `);
      } catch (e) {
        // Safe ignore
      }

      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS installation_records (
            id TEXT PRIMARY KEY,
            lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'PENDING_ASSIGNMENT' CHECK (status IN ('PENDING_ASSIGNMENT', 'ASSIGNED', 'COMPLETED')),
            assigned_installer_id TEXT REFERENCES users(id),
            assigned_by_id TEXT REFERENCES users(id),
            assigned_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            completed_by TEXT REFERENCES users(id),
            completion_remarks TEXT,
            inverter_serial_number TEXT,
            solar_panel_details TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_installation_records_lead ON installation_records(lead_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_installation_records_status ON installation_records(status)`);
      } catch (e) {
        // Safe ignore
      }

      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS installation_photos (
            id TEXT PRIMARY KEY,
            lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            photo_category TEXT NOT NULL CHECK (photo_category IN ('INVERTER_SERIAL', 'INVERTER_WITH_CUSTOMER', 'PANEL_WITH_CUSTOMER', 'LIGHTNING_ARRESTER', 'EARTHING_PIT')),
            uploader_id TEXT NOT NULL REFERENCES users(id),
            file_path TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes BIGINT NOT NULL,
            uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_installation_photos_lead ON installation_photos(lead_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_installation_photos_category ON installation_photos(lead_id, photo_category)`);
      } catch (e) {
        // Safe ignore
      }

      // Accounts team migrations: leads dispatch & B2B credit columns
      try {
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS dispatch_status TEXT NOT NULL DEFAULT 'PENDING_ADVANCE'`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS dispatch_cleared_at TIMESTAMPTZ`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS dispatch_cleared_by TEXT REFERENCES users(id)`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS dispatch_remarks TEXT`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS b2b_credit_days INTEGER DEFAULT 30`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS b2b_credit_due_date DATE`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS b2b_credit_compliance_status TEXT DEFAULT 'PENDING_REVIEW'`);
      } catch (e) {
        // Safe ignore
      }

      // Accounts team migrations: customer_receipts table
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS customer_receipts (
            id TEXT PRIMARY KEY,
            receipt_number TEXT UNIQUE NOT NULL,
            lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            amount NUMERIC(14,2) NOT NULL,
            receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
            payment_mode TEXT NOT NULL CHECK (payment_mode IN ('NEFT_RTGS', 'CHEQUE', 'UPI', 'BANK_TRANSFER', 'CASH', 'BANK_LOAN_DISBURSEMENT')),
            reference_number TEXT,
            receipt_type TEXT NOT NULL CHECK (receipt_type IN ('ADVANCE', 'PROGRESS_MILESTONE', 'BANK_LOAN_DISBURSEMENT', 'FINAL_SETTLEMENT')),
            payer_type TEXT NOT NULL CHECK (payer_type IN ('CUSTOMER', 'BANK', 'THIRD_PARTY')),
            payer_name TEXT,
            bank_name TEXT,
            deposited_in_account TEXT,
            status TEXT NOT NULL DEFAULT 'CLEARED' CHECK (status IN ('PENDING_CLEARANCE', 'CLEARED', 'BOUNCED', 'CANCELLED')),
            remarks TEXT,
            recorded_by TEXT NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_customer_receipts_lead ON customer_receipts(lead_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_customer_receipts_date ON customer_receipts(receipt_date)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_customer_receipts_type ON customer_receipts(receipt_type)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_customer_receipts_status ON customer_receipts(status)`);
      } catch (e) {
        // Safe ignore
      }

      // Accounts team migrations: receipt_followups table
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS receipt_followups (
            id TEXT PRIMARY KEY,
            lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            follow_up_date TIMESTAMPTZ NOT NULL,
            promised_payment_date DATE,
            promised_amount NUMERIC(14,2),
            contact_person TEXT,
            contact_phone TEXT,
            status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'PROMISED_TO_PAY', 'DISPUTED', 'CANCELLED')),
            remarks TEXT NOT NULL,
            outcome_notes TEXT,
            recorded_by TEXT NOT NULL REFERENCES users(id),
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_receipt_followups_lead ON receipt_followups(lead_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_receipt_followups_date ON receipt_followups(follow_up_date)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_receipt_followups_status ON receipt_followups(status)`);
      } catch (e) {
        // Safe ignore
      }

      // Dispatch team migrations: dispatch_records table and lead dispatch logistics columns
      try {
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS transporter_name TEXT`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS lr_number TEXT`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS vehicle_number TEXT`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS driver_name TEXT`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS driver_phone TEXT`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS dispatch_date DATE`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS actual_delivery_date DATE`);
        await db.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_challan_number TEXT`);
      } catch (e) {
        // Safe ignore
      }

      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS dispatch_records (
            id TEXT PRIMARY KEY,
            lead_id TEXT UNIQUE NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'PENDING_CLEARANCE' CHECK (status IN ('PENDING_CLEARANCE', 'READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED', 'CANCELLED')),
            transporter_name TEXT,
            lr_number TEXT,
            vehicle_number TEXT,
            driver_name TEXT,
            driver_phone TEXT,
            dispatch_date DATE,
            estimated_delivery_date DATE,
            actual_delivery_date DATE,
            delivery_challan_number TEXT,
            dispatch_notes TEXT,
            delivery_proof_url TEXT,
            dispatched_by TEXT REFERENCES users(id),
            delivered_by TEXT REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_dispatch_records_lead ON dispatch_records(lead_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_dispatch_records_status ON dispatch_records(status)`);
      } catch (e) {
        // Safe ignore
      }

      // Compatibility view: quotation_items mapping to quotation_lines
      try {
        await db.query(`CREATE OR REPLACE VIEW quotation_items AS SELECT * FROM quotation_lines`);
      } catch (e) {
        // Safe ignore
      }

      // Ensure default Dispatch user exists
      try {
        const dispatchUser = await db.query(`SELECT id FROM users WHERE role = 'DISPATCH' LIMIT 1`);
        if (dispatchUser.rows.length === 0) {
          await db.query(`
            INSERT INTO users (id, username, password_hash, name, role, active, created_at, updated_at)
            VALUES (
              'u-dispatch-001',
              'dispatch',
              '$2a$10$e8T8W1t6QvG7q/9Ue7T8w.wE9i6Y7Pj13k8G1T3wK.e8Z4d7876a',
              'Dinesh Rathore (Dispatch Team)',
              'DISPATCH',
              true,
              NOW(),
              NOW()
            )
            ON CONFLICT (username) DO NOTHING
          `);
        }
      } catch (e) {
        // Safe ignore
      }

      // Ensure service_complaints and activities tables exist
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS service_complaints (
            id TEXT PRIMARY KEY,
            ticket_number TEXT UNIQUE NOT NULL,
            lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
            customer_name TEXT NOT NULL,
            customer_phone VARCHAR(20) NOT NULL,
            customer_email TEXT,
            customer_address TEXT,
            city TEXT,
            system_capacity_kw NUMERIC(8,2),
            inverter_brand_model TEXT,
            inverter_serial TEXT,
            commissioning_date DATE,
            category TEXT NOT NULL,
            priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
            status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED')),
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            reported_channel TEXT NOT NULL DEFAULT 'PHONE',
            reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            sla_due_at TIMESTAMPTZ NOT NULL,
            assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            assigned_to_name TEXT,
            assigned_at TIMESTAMPTZ,
            assignment_notes TEXT,
            technician_visit_date DATE,
            root_cause TEXT,
            action_taken TEXT,
            parts_replaced TEXT,
            is_warranty_claim BOOLEAN NOT NULL DEFAULT false,
            warranty_claim_number TEXT,
            resolution_notes TEXT,
            resolved_at TIMESTAMPTZ,
            resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
            customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
            customer_feedback TEXT,
            closed_at TIMESTAMPTZ,
            closed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
            created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_service_complaints_lead ON service_complaints(lead_id);
          CREATE INDEX IF NOT EXISTS idx_service_complaints_status ON service_complaints(status);
          CREATE INDEX IF NOT EXISTS idx_service_complaints_assigned ON service_complaints(assigned_to_user_id);
          CREATE INDEX IF NOT EXISTS idx_service_complaints_priority ON service_complaints(priority);

          CREATE TABLE IF NOT EXISTS service_complaint_activities (
            id TEXT PRIMARY KEY,
            complaint_id TEXT NOT NULL REFERENCES service_complaints(id) ON DELETE CASCADE,
            actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            actor_name TEXT NOT NULL,
            action_type TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_service_complaint_activities_comp ON service_complaint_activities(complaint_id);
        `);
      } catch (e) {
        // Safe ignore
      }

      // Ensure default Service Desk user exists with valid credentials
      try {
        const passwordHash = bcrypt.hashSync('Solar@123', 10);
        const serviceUser = await db.query(`SELECT id FROM users WHERE username = 'service1' LIMIT 1`);
        if (serviceUser.rows.length === 0) {
          await db.query(`
            INSERT INTO users (id, username, password_hash, name, role, active, created_at, updated_at)
            VALUES (
              'u-service-001',
              'service1',
              $1,
              'Vikram Joshi (Service Desk)',
              'SERVICE',
              true,
              NOW(),
              NOW()
            )
            ON CONFLICT (username) DO NOTHING
          `, [passwordHash]);
        } else {
          await db.query(`UPDATE users SET password_hash = $1, role = 'SERVICE' WHERE username = 'service1'`, [passwordHash]);
        }
      } catch (e) {
        // Safe ignore
      }

      // Masters soft-delete columns & UOM code migration
      try {
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
        await db.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
        await db.query(`ALTER TABLE uoms ADD COLUMN IF NOT EXISTS code TEXT`);
        await db.query(`ALTER TABLE uoms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
        await db.query(`UPDATE uoms SET code = name WHERE code IS NULL OR code = ''`);
        await db.query(`ALTER TABLE lead_custom_field_definitions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
        await db.query(`ALTER TABLE document_definitions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
        await db.query(`ALTER TABLE document_requirement_rules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
      } catch (e) {
        // Safe ignore
      }

      console.log('[DB] Schema initialized successfully.');
    }
  } catch (err) {
    console.error('[DB] Error initializing schema:', err);
    throw err;
  }
}
