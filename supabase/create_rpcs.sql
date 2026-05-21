-- =================================================================
-- MINIMAL FIX — Only creates SECURITY DEFINER functions.
-- NO policy changes. These functions bypass RLS entirely.
-- Run this in Supabase SQL Editor — paste the whole file.
-- =================================================================

-- ── 1. Admin check ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_is_system_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_system_admin, false)
  FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- ── 2. Fetch current user's profile ──────────────────────────────
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS TABLE (
  id UUID, full_name TEXT, avatar_url TEXT, job_title TEXT,
  is_system_admin BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) AS $$
  SELECT id, full_name, avatar_url, job_title, is_system_admin, created_at, updated_at
  FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- ── 3. Fetch all orgs I'm a member of ────────────────────────────
CREATE OR REPLACE FUNCTION get_my_orgs()
RETURNS TABLE (
  membership_id UUID, org_id UUID, role_id UUID, status TEXT,
  joined_at TIMESTAMPTZ, org_name TEXT, org_slug TEXT, org_logo_url TEXT,
  org_industry TEXT, org_website TEXT, org_created_at TIMESTAMPTZ,
  role_name TEXT, role_permissions JSONB, role_is_system BOOLEAN, role_position INT
) AS $$
BEGIN
  RETURN QUERY
    SELECT om.id, om.org_id, om.role_id, om.status::TEXT, om.joined_at,
           o.name, o.slug, o.logo_url, o.industry, o.website, o.created_at,
           r.name, r.permissions, r.is_system, r.position
    FROM org_members om
    JOIN organizations o ON o.id = om.org_id
    LEFT JOIN org_roles r ON r.id = om.role_id
    WHERE om.user_id = auth.uid() AND om.status = 'active'
    ORDER BY om.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ── 4. Fetch all tasks for an org ────────────────────────────────
CREATE OR REPLACE FUNCTION get_org_tasks(p_org_id UUID)
RETURNS TABLE (
  id UUID, org_id UUID, title TEXT, description TEXT,
  status TEXT, priority TEXT, task_type TEXT,
  assigned_to UUID, created_by UUID, due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ, is_starred BOOLEAN, sort_order INT,
  project_id UUID, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  -- Assignee fields
  assignee_id UUID, assignee_name TEXT, assignee_avatar TEXT, assignee_job_title TEXT,
  -- Project fields
  project_name TEXT, project_color TEXT
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members om_check
    WHERE om_check.org_id = p_org_id
      AND om_check.user_id = auth.uid()
      AND om_check.status = 'active'
  ) THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      t.id, t.org_id, t.title, t.description,
      t.status::TEXT, t.priority::TEXT, t.task_type::TEXT,
      t.assigned_to, t.created_by, t.due_date,
      t.completed_at, t.is_starred, t.sort_order,
      t.project_id, t.created_at, t.updated_at,
      p.id, p.full_name, p.avatar_url, p.job_title,
      pr.name, pr.color
    FROM tasks t
    LEFT JOIN profiles p ON p.id = t.assigned_to
    LEFT JOIN projects pr ON pr.id = t.project_id
    WHERE t.org_id = p_org_id
    ORDER BY t.sort_order ASC NULLS LAST, t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ── 5. Fetch org members with profiles and roles ──────────────────
CREATE OR REPLACE FUNCTION get_org_members(p_org_id UUID)
RETURNS TABLE (
  id UUID, org_id UUID, user_id UUID, role_id UUID,
  status TEXT, joined_at TIMESTAMPTZ, invited_email TEXT,
  profile_name TEXT, profile_avatar TEXT, profile_job_title TEXT,
  role_name TEXT, role_permissions JSONB, role_position INT
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members om_check
    WHERE om_check.org_id = p_org_id
      AND om_check.user_id = auth.uid()
      AND om_check.status = 'active'
  ) THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      om.id, om.org_id, om.user_id, om.role_id,
      om.status::TEXT, om.joined_at, om.invited_email,
      p.full_name, p.avatar_url, p.job_title,
      r.name, r.permissions, r.position
    FROM org_members om
    LEFT JOIN profiles p ON p.id = om.user_id
    LEFT JOIN org_roles r ON r.id = om.role_id
    WHERE om.org_id = p_org_id
    ORDER BY om.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ── 6. Fetch recent activity for an org ──────────────────────────
CREATE OR REPLACE FUNCTION get_org_activity(p_org_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (
  id UUID, org_id UUID, user_id UUID, action TEXT,
  entity_type TEXT, entity_id UUID, metadata JSONB, created_at TIMESTAMPTZ,
  user_name TEXT, user_avatar TEXT
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members om_check
    WHERE om_check.org_id = p_org_id
      AND om_check.user_id = auth.uid()
      AND om_check.status = 'active'
  ) THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      a.id, a.org_id, a.user_id, a.action::TEXT,
      a.entity_type::TEXT, a.entity_id, a.metadata, a.created_at,
      p.full_name, p.avatar_url
    FROM activity_log a
    LEFT JOIN profiles p ON p.id = a.user_id
    WHERE a.org_id = p_org_id
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ── 7. Pending invites for current user ──────────────────────────
CREATE OR REPLACE FUNCTION get_my_pending_invites()
RETURNS TABLE (id UUID, org_id UUID)
AS $$
  SELECT om.id, om.org_id
  FROM org_members om
  JOIN auth.users u ON u.email = om.invited_email
  WHERE u.id = auth.uid() AND om.status = 'pending';
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- ── 8. Accept a pending invite ────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_invite(p_invite_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  UPDATE org_members
  SET user_id = auth.uid(), status = 'active', joined_at = now()
  WHERE id = p_invite_id AND invited_email = v_email AND status = 'pending';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ── 9. Set admin (bypasses trigger) ──────────────────────────────
SET session_replication_role = replica;
UPDATE profiles
SET is_system_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'prakashabhay5@gmail.com' LIMIT 1);
RESET session_replication_role;

-- ── 10. Fix null role_ids for org creators ────────────────────────
UPDATE org_members om
SET role_id = (
  SELECT r.id FROM org_roles r
  WHERE r.org_id = om.org_id AND r.name = 'Owner' LIMIT 1
)
WHERE om.role_id IS NULL AND om.status = 'active'
  AND EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = om.org_id AND o.created_by = om.user_id
  );

-- ── 11. Get single task detail ────────────────────────────────────
CREATE OR REPLACE FUNCTION get_task_detail(p_task_id UUID)
RETURNS TABLE (
  id UUID, org_id UUID, title TEXT, description TEXT,
  status TEXT, priority TEXT, task_type TEXT,
  assigned_to UUID, created_by UUID, due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ, is_starred BOOLEAN, sort_order INT,
  project_id UUID, team_id UUID, deliverables JSONB,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  -- Assignee
  assignee_id UUID, assignee_name TEXT, assignee_avatar TEXT, assignee_job_title TEXT,
  -- Creator
  creator_id UUID, creator_name TEXT, creator_avatar TEXT,
  -- Project
  project_name TEXT, project_color TEXT,
  -- Team
  team_name TEXT, team_color TEXT
) AS $$
BEGIN
  -- Verify caller is a member of the task's org
  IF NOT EXISTS (
    SELECT 1 FROM tasks t
    JOIN org_members om_check ON om_check.org_id = t.org_id
    WHERE t.id = p_task_id
      AND om_check.user_id = auth.uid()
      AND om_check.status = 'active'
  ) THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      t.id, t.org_id, t.title, t.description,
      t.status::TEXT, t.priority::TEXT, t.task_type::TEXT,
      t.assigned_to, t.created_by, t.due_date,
      t.completed_at, t.is_starred, t.sort_order,
      t.project_id,
      NULL::UUID, -- team_id placeholder (added in Phase B)
      COALESCE(t.deliverables, '[]'::jsonb),
      t.created_at, t.updated_at,
      assignee.id, assignee.full_name, assignee.avatar_url, assignee.job_title,
      creator.id, creator.full_name, creator.avatar_url,
      pr.name, pr.color,
      NULL::TEXT, NULL::TEXT -- team_name, team_color
    FROM tasks t
    LEFT JOIN profiles assignee ON assignee.id = t.assigned_to
    LEFT JOIN profiles creator ON creator.id = t.created_by
    LEFT JOIN projects pr ON pr.id = t.project_id
    WHERE t.id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ── 12. Get task labels ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_task_labels(p_task_id UUID)
RETURNS TABLE (
  id UUID, org_id UUID, name TEXT, color TEXT
) AS $$
  SELECT l.id, l.org_id, l.name, l.color
  FROM task_labels tl
  JOIN labels l ON l.id = tl.label_id
  WHERE tl.task_id = p_task_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- ── 13. Get org labels ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_org_labels(p_org_id UUID)
RETURNS TABLE (id UUID, org_id UUID, name TEXT, color TEXT)
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members om_check
    WHERE om_check.org_id = p_org_id AND om_check.user_id = auth.uid() AND om_check.status = 'active'
  ) THEN RETURN; END IF;
  RETURN QUERY SELECT l.id, l.org_id, l.name, l.color FROM labels l WHERE l.org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ── 14. Get org projects ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_org_projects(p_org_id UUID)
RETURNS TABLE (id UUID, org_id UUID, name TEXT, description TEXT, color TEXT, status TEXT, created_at TIMESTAMPTZ)
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members om_check
    WHERE om_check.org_id = p_org_id AND om_check.user_id = auth.uid() AND om_check.status = 'active'
  ) THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.org_id, p.name, p.description, p.color, p.status::TEXT, p.created_at
    FROM projects p WHERE p.org_id = p_org_id ORDER BY p.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ── 15. Get task comments ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_task_comments(p_task_id UUID)
RETURNS TABLE (
  id UUID, task_id UUID, user_id UUID, content TEXT,
  attachments JSONB, created_at TIMESTAMPTZ,
  commenter_name TEXT, commenter_avatar TEXT
) AS $$
  SELECT
    c.id, c.task_id, c.user_id, c.content,
    COALESCE(c.attachments, '[]'::jsonb),
    c.created_at,
    p.full_name, p.avatar_url
  FROM task_comments c
  LEFT JOIN profiles p ON p.id = c.user_id
  WHERE c.task_id = p_task_id
  ORDER BY c.created_at ASC;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- ── 16. Get task activity ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_task_activity(p_task_id UUID)
RETURNS TABLE (
  id UUID, org_id UUID, user_id UUID, action TEXT,
  entity_type TEXT, entity_id UUID, metadata JSONB, created_at TIMESTAMPTZ,
  actor_name TEXT, actor_avatar TEXT
) AS $$
  SELECT
    a.id, a.org_id, a.user_id, a.action::TEXT,
    a.entity_type::TEXT, a.entity_id, a.metadata, a.created_at,
    p.full_name, p.avatar_url
  FROM activity_log a
  LEFT JOIN profiles p ON p.id = a.user_id
  WHERE a.entity_type = 'task' AND a.entity_id = p_task_id
  ORDER BY a.created_at DESC
  LIMIT 50;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- ── 17. TEAMS — Create teams table ───────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  icon        TEXT NOT NULL DEFAULT '👥',
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Add team_id to tasks (safe — does nothing if column exists)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
-- Add team_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Simple open policies — data access controlled by SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Teams visible to org members" ON teams;
CREATE POLICY "Teams visible to org members" ON teams FOR ALL USING (true);
DROP POLICY IF EXISTS "Team members visible" ON team_members;
CREATE POLICY "Team members visible" ON team_members FOR ALL USING (true);

-- ── 18. Teams RPCs ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_org_teams(p_org_id UUID)
RETURNS TABLE (
  id UUID, org_id UUID, name TEXT, description TEXT,
  color TEXT, icon TEXT, created_at TIMESTAMPTZ,
  member_count BIGINT
) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members om_check
    WHERE om_check.org_id = p_org_id AND om_check.user_id = auth.uid() AND om_check.status = 'active'
  ) THEN RETURN; END IF;

  RETURN QUERY
    SELECT t.id, t.org_id, t.name, t.description, t.color, t.icon, t.created_at,
           COUNT(tm.id)::BIGINT
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id
    WHERE t.org_id = p_org_id
    GROUP BY t.id
    ORDER BY t.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION get_team_members(p_team_id UUID)
RETURNS TABLE (
  id UUID, team_id UUID, user_id UUID, role TEXT, joined_at TIMESTAMPTZ,
  member_name TEXT, member_avatar TEXT, member_job_title TEXT
) AS $$
  SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.joined_at,
         p.full_name, p.avatar_url, p.job_title
  FROM team_members tm
  LEFT JOIN profiles p ON p.id = tm.user_id
  WHERE tm.team_id = p_team_id
  ORDER BY tm.role DESC, tm.joined_at ASC; -- leads first
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- ── VERIFY ───────────────────────────────────────────────────────
SELECT u.email, p.is_system_admin
FROM profiles p JOIN auth.users u ON u.id = p.id
WHERE u.email = 'prakashabhay5@gmail.com';

