-- =========================================================================
-- TASKFLOW — UNIFIED DATABASE MIGRATION
-- Run this ONCE in a clean Supabase project (SQL Editor).
-- =========================================================================

-- =============================================
-- 1. CUSTOM TYPES (ENUMS)
-- =============================================
CREATE TYPE member_status  AS ENUM ('active', 'pending', 'suspended');
CREATE TYPE project_status AS ENUM ('active', 'archived', 'completed');
CREATE TYPE task_status    AS ENUM ('todo', 'in_progress', 'in_review', 'done', 'blocked');
CREATE TYPE task_type_enum AS ENUM ('general', 'design', 'development', 'testing', 'review');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');

-- =============================================
-- 2. TABLES
-- =============================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  job_title TEXT,
  is_system_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  industry TEXT,
  website TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization Roles (custom roles per org)
CREATE TABLE org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Organization Members
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES org_roles(id) ON DELETE SET NULL,
  invited_email TEXT,
  invite_token UUID DEFAULT gen_random_uuid(),
  status member_status NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, invited_email)
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  status project_status NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  task_type task_type_enum NOT NULL DEFAULT 'general',
  priority priority_level NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  is_starred BOOLEAN DEFAULT false,
  deliverables JSONB DEFAULT '[]',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task Comments
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Labels (for tasks)
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  UNIQUE(org_id, name)
);

-- Task Labels (join table)
CREATE TABLE task_labels (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['read'],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activity Log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 3. INDEXES
-- =============================================
CREATE INDEX idx_org_members_user     ON org_members(user_id);
CREATE INDEX idx_org_members_org      ON org_members(org_id);
CREATE INDEX idx_org_members_token    ON org_members(invite_token);
CREATE INDEX idx_org_members_email    ON org_members(invited_email);
CREATE INDEX idx_tasks_org            ON tasks(org_id);
CREATE INDEX idx_tasks_assigned       ON tasks(assigned_to);
CREATE INDEX idx_tasks_project        ON tasks(project_id);
CREATE INDEX idx_tasks_status         ON tasks(status);
CREATE INDEX idx_tasks_due            ON tasks(due_date);
CREATE INDEX idx_tasks_starred        ON tasks(is_starred) WHERE is_starred = true;
CREATE INDEX idx_task_comments_task   ON task_comments(task_id);
CREATE INDEX idx_task_labels_task     ON task_labels(task_id);
CREATE INDEX idx_task_labels_label    ON task_labels(label_id);
CREATE INDEX idx_activity_log_org     ON activity_log(org_id);
CREATE INDEX idx_activity_log_entity  ON activity_log(entity_type, entity_id);
CREATE INDEX idx_api_keys_org         ON api_keys(org_id);
CREATE INDEX idx_api_keys_prefix      ON api_keys(key_prefix);

-- =============================================
-- 4. ENABLE RLS
-- =============================================
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_labels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log  ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

-- Check if user is an active member of an org
CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- Get user's permissions in an org (returns the JSONB permissions object)
CREATE OR REPLACE FUNCTION get_user_permissions(org_uuid UUID)
RETURNS JSONB AS $$
  SELECT COALESCE(r.permissions, '{}'::JSONB)
  FROM org_members m
  JOIN org_roles r ON r.id = m.role_id
  WHERE m.org_id = org_uuid
    AND m.user_id = auth.uid()
    AND m.status = 'active'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- Check if user has a specific permission in an org
CREATE OR REPLACE FUNCTION has_permission(org_uuid UUID, perm TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (get_user_permissions(org_uuid) ->> perm)::BOOLEAN,
    false
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- Seed default roles for a new organization
CREATE OR REPLACE FUNCTION seed_default_roles(org_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO org_roles (org_id, name, is_system, position, permissions) VALUES
  (org_uuid, 'Owner', true, 0, '{
    "tasks.create": true, "tasks.edit_own": true, "tasks.edit_all": true, "tasks.delete": true, "tasks.assign": true,
    "projects.create": true, "projects.edit": true, "projects.delete": true,
    "team.view": true, "team.invite": true, "team.manage_roles": true,
    "settings.edit": true, "api_keys.manage": true, "labels.manage": true
  }'::JSONB),
  (org_uuid, 'Admin', true, 1, '{
    "tasks.create": true, "tasks.edit_own": true, "tasks.edit_all": true, "tasks.delete": true, "tasks.assign": true,
    "projects.create": true, "projects.edit": true, "projects.delete": true,
    "team.view": true, "team.invite": true, "team.manage_roles": true,
    "settings.edit": true, "api_keys.manage": true, "labels.manage": true
  }'::JSONB),
  (org_uuid, 'Manager', true, 2, '{
    "tasks.create": true, "tasks.edit_own": true, "tasks.edit_all": true, "tasks.delete": false, "tasks.assign": true,
    "projects.create": true, "projects.edit": true, "projects.delete": false,
    "team.view": true, "team.invite": true, "team.manage_roles": false,
    "settings.edit": false, "api_keys.manage": false, "labels.manage": true
  }'::JSONB),
  (org_uuid, 'Member', true, 3, '{
    "tasks.create": true, "tasks.edit_own": true, "tasks.edit_all": false, "tasks.delete": false, "tasks.assign": false,
    "projects.create": false, "projects.edit": false, "projects.delete": false,
    "team.view": true, "team.invite": false, "team.manage_roles": false,
    "settings.edit": false, "api_keys.manage": false, "labels.manage": false
  }'::JSONB),
  (org_uuid, 'Viewer', true, 4, '{
    "tasks.create": false, "tasks.edit_own": false, "tasks.edit_all": false, "tasks.delete": false, "tasks.assign": false,
    "projects.create": false, "projects.edit": false, "projects.delete": false,
    "team.view": true, "team.invite": false, "team.manage_roles": false,
    "settings.edit": false, "api_keys.manage": false, "labels.manage": false
  }'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================
-- 6. RLS POLICIES
-- =============================================

-- PROFILES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view same-org profiles"
  ON profiles FOR SELECT USING (
    id IN (
      SELECT user_id FROM org_members
      WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND status = 'active')
      AND user_id IS NOT NULL
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- ORGANIZATIONS
CREATE POLICY "Members can view their orgs"
  ON organizations FOR SELECT USING (is_org_member(organizations.id) OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create orgs"
  ON organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Permitted users can update orgs"
  ON organizations FOR UPDATE USING (has_permission(organizations.id, 'settings.edit'));

CREATE POLICY "Owners can delete orgs"
  ON organizations FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM org_members m
      JOIN org_roles r ON r.id = m.role_id
      WHERE m.org_id = organizations.id AND m.user_id = auth.uid() AND m.status = 'active' AND r.name = 'Owner'
    )
  );

-- ORG_ROLES
CREATE POLICY "Members can view org roles"
  ON org_roles FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Role managers can insert roles"
  ON org_roles FOR INSERT WITH CHECK (has_permission(org_id, 'team.manage_roles'));

CREATE POLICY "Role managers can update roles"
  ON org_roles FOR UPDATE USING (has_permission(org_id, 'team.manage_roles'));

CREATE POLICY "Role managers can delete custom roles"
  ON org_roles FOR DELETE USING (has_permission(org_id, 'team.manage_roles') AND is_system = false);

-- ORG_MEMBERS
CREATE POLICY "Members can view org members"
  ON org_members FOR SELECT USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Inviters can insert org members"
  ON org_members FOR INSERT WITH CHECK (
    has_permission(org_id, 'team.invite')
    OR (
      -- Allow the creator to add themselves as the first member (org setup)
      EXISTS (SELECT 1 FROM organizations WHERE id = org_id AND created_by = auth.uid())
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update org members"
  ON org_members FOR UPDATE USING (
    has_permission(org_id, 'team.invite')
    OR (
      -- Allow invited user to accept their own pending invite
      invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND status = 'pending'
    )
  );

CREATE POLICY "Admins can delete org members"
  ON org_members FOR DELETE USING (has_permission(org_id, 'team.invite'));

-- PROJECTS
CREATE POLICY "Members can view projects"
  ON projects FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = projects.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "Permitted users can create projects"
  ON projects FOR INSERT WITH CHECK (has_permission(org_id, 'projects.create'));

CREATE POLICY "Permitted users can update projects"
  ON projects FOR UPDATE USING (has_permission(org_id, 'projects.edit'));

CREATE POLICY "Permitted users can delete projects"
  ON projects FOR DELETE USING (has_permission(org_id, 'projects.delete'));

-- TASKS
CREATE POLICY "Members can view tasks"
  ON tasks FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = tasks.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "Permitted users can create tasks"
  ON tasks FOR INSERT WITH CHECK (has_permission(org_id, 'tasks.create'));

CREATE POLICY "Permitted users can update tasks"
  ON tasks FOR UPDATE USING (
    has_permission(org_id, 'tasks.edit_all')
    OR (has_permission(org_id, 'tasks.edit_own') AND (assigned_to = auth.uid() OR created_by = auth.uid()))
  );

CREATE POLICY "Permitted users can delete tasks"
  ON tasks FOR DELETE USING (has_permission(org_id, 'tasks.delete'));

-- TASK_COMMENTS
CREATE POLICY "Members can view comments"
  ON task_comments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members om
      JOIN tasks t ON t.id = task_comments.task_id
      WHERE om.org_id = t.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Members can create comments"
  ON task_comments FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM org_members om
      JOIN tasks t ON t.id = task_comments.task_id
      WHERE om.org_id = t.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Users can delete own comments"
  ON task_comments FOR DELETE USING (user_id = auth.uid());

-- LABELS
CREATE POLICY "Members can view labels"
  ON labels FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = labels.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "Permitted users can manage labels"
  ON labels FOR ALL USING (has_permission(org_id, 'labels.manage'));

-- TASK_LABELS
CREATE POLICY "Members can view task labels"
  ON task_labels FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members om
      JOIN tasks t ON t.id = task_labels.task_id
      WHERE om.org_id = t.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Permitted users can manage task labels"
  ON task_labels FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_members om
      JOIN tasks t ON t.id = task_labels.task_id
      WHERE om.org_id = t.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- API_KEYS
CREATE POLICY "Permitted users can view api keys"
  ON api_keys FOR SELECT USING (has_permission(org_id, 'api_keys.manage'));

CREATE POLICY "Permitted users can create api keys"
  ON api_keys FOR INSERT WITH CHECK (has_permission(org_id, 'api_keys.manage'));

CREATE POLICY "Permitted users can update api keys"
  ON api_keys FOR UPDATE USING (has_permission(org_id, 'api_keys.manage'));

CREATE POLICY "Permitted users can delete api keys"
  ON api_keys FOR DELETE USING (has_permission(org_id, 'api_keys.manage'));

-- ACTIVITY_LOG
CREATE POLICY "Members can view activity"
  ON activity_log FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = activity_log.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "Members can insert activity"
  ON activity_log FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = activity_log.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- =============================================
-- 7. STORAGE
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;
CREATE POLICY "Anyone can view attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

-- =============================================
-- 8. TRIGGERS
-- =============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup + set admin flag
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, is_system_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    (NEW.email = 'prakashabhay5@gmail.com')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Prevent non-admin privilege escalation via the client,
-- but allow superuser / SQL Editor (auth.uid() IS NULL) to set admin freely.
CREATE OR REPLACE FUNCTION check_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If is_system_admin is not changing, nothing to check
  IF NEW.is_system_admin IS NOT DISTINCT FROM OLD.is_system_admin THEN
    RETURN NEW;
  END IF;

  -- Allow postgres superuser / service role (SQL Editor context where auth.uid() is NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- For regular authenticated users: only an existing system admin can change this flag
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_system_admin = true
  ) THEN
    NEW.is_system_admin = OLD.is_system_admin; -- revert for non-admins
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE TRIGGER tr_check_profile_update
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION check_profile_update();

-- Auto-seed default roles on org creation AND auto-add creator as Owner
CREATE OR REPLACE FUNCTION on_org_created()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_role_id UUID;
BEGIN
  -- Seed the 5 default roles first
  PERFORM seed_default_roles(NEW.id);

  -- Grab the Owner role just seeded
  SELECT id INTO v_owner_role_id
  FROM org_roles
  WHERE org_id = NEW.id AND name = 'Owner'
  LIMIT 1;

  -- Auto-add creator as active Owner (SECURITY DEFINER bypasses RLS)
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO org_members (org_id, user_id, role_id, status, joined_at)
    VALUES (NEW.id, NEW.created_by, v_owner_role_id, 'active', now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_org_created
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION on_org_created();

-- Auto-log task changes to activity_log
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO activity_log (org_id, user_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.org_id, auth.uid(), 'status_changed', 'task', NEW.id,
      jsonb_build_object('old_status', OLD.status::TEXT, 'new_status', NEW.status::TEXT, 'task_title', NEW.title));
  END IF;

  -- Log assignment changes
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO activity_log (org_id, user_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.org_id, auth.uid(), 'assignment_changed', 'task', NEW.id,
      jsonb_build_object('old_assignee', OLD.assigned_to::TEXT, 'new_assignee', NEW.assigned_to::TEXT, 'task_title', NEW.title));
  END IF;

  -- Log priority changes
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO activity_log (org_id, user_id, action, entity_type, entity_id, metadata)
    VALUES (NEW.org_id, auth.uid(), 'priority_changed', 'task', NEW.id,
      jsonb_build_object('old_priority', OLD.priority::TEXT, 'new_priority', NEW.priority::TEXT, 'task_title', NEW.title));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_task_changes
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_changes();

-- =============================================
-- 9. ADMIN RPCs (SECURITY DEFINER)
-- =============================================

CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS TABLE (total_users BIGINT, total_organizations BIGINT, total_tasks BIGINT, total_projects BIGINT) AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_system_admin = true) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;
  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM profiles)::BIGINT,
    (SELECT COUNT(*) FROM organizations)::BIGINT,
    (SELECT COUNT(*) FROM tasks)::BIGINT,
    (SELECT COUNT(*) FROM projects)::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE (user_id UUID, email VARCHAR, full_name TEXT, job_title TEXT, is_system_admin BOOLEAN, created_at TIMESTAMPTZ) AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_system_admin = true) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;
  RETURN QUERY
    SELECT p.id, u.email::VARCHAR, p.full_name, p.job_title, p.is_system_admin, p.created_at
    FROM profiles p JOIN auth.users u ON p.id = u.id
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_get_organizations()
RETURNS TABLE (org_id UUID, name TEXT, slug TEXT, industry TEXT, created_at TIMESTAMPTZ, member_count BIGINT, task_count BIGINT) AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_system_admin = true) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;
  RETURN QUERY
    SELECT o.id, o.name, o.slug, o.industry, o.created_at,
      COALESCE((SELECT COUNT(*) FROM org_members m WHERE m.org_id = o.id AND m.status = 'active'), 0)::BIGINT,
      COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.org_id = o.id), 0)::BIGINT
    FROM organizations o ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_toggle_system_admin(target_user_id UUID, make_admin BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_system_admin = true) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;
  IF target_user_id = auth.uid() AND make_admin = false THEN
    RAISE EXCEPTION 'Cannot revoke own admin status';
  END IF;
  UPDATE profiles SET is_system_admin = make_admin, updated_at = now() WHERE id = target_user_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_system_admin = true) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete own account';
  END IF;
  -- Delete from auth.users — cascades to profiles, org_members, task_comments, etc.
  DELETE FROM auth.users WHERE id = target_user_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 10. USER-FACING RPC (bypasses RLS safely)
-- =============================================

-- Fetch all orgs the current user is an active member of.
-- SECURITY DEFINER avoids the circular RLS dependency on org_members.
CREATE OR REPLACE FUNCTION get_my_orgs()
RETURNS TABLE (
  membership_id    UUID,
  org_id           UUID,
  role_id          UUID,
  status           TEXT,
  joined_at        TIMESTAMPTZ,
  org_name         TEXT,
  org_slug         TEXT,
  org_logo_url     TEXT,
  org_industry     TEXT,
  org_website      TEXT,
  org_created_at   TIMESTAMPTZ,
  role_name        TEXT,
  role_permissions JSONB,
  role_is_system   BOOLEAN,
  role_position    INT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      om.id,
      om.org_id,
      om.role_id,
      om.status::TEXT,
      om.joined_at,
      o.name,
      o.slug,
      o.logo_url,
      o.industry,
      o.website,
      o.created_at,
      r.name,
      r.permissions,
      r.is_system,
      r.position
    FROM org_members om
    JOIN organizations o ON o.id = om.org_id
    LEFT JOIN org_roles r ON r.id = om.role_id
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
    ORDER BY om.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
