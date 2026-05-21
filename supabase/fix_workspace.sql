-- ============================================================
-- PATCH: Fix workspace creation & org fetch reliability
-- Run this in Supabase SQL Editor AFTER migration.sql
-- ============================================================

-- 0. DATA FIX: Repair existing members who have role_id = null
--    This fixes the "no New Task / no Invite button" problem.
--    Assigns the Owner role to any creator who is the only active member.
UPDATE org_members om
SET role_id = (
  SELECT r.id FROM org_roles r
  WHERE r.org_id = om.org_id AND r.name = 'Owner'
  LIMIT 1
)
WHERE om.role_id IS NULL
  AND om.status = 'active'
  AND EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = om.org_id AND o.created_by = om.user_id
  );

-- 1. Update on_org_created trigger to auto-add creator as Owner
--    (SECURITY DEFINER bypasses RLS — no client-side insert needed)
CREATE OR REPLACE FUNCTION on_org_created()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_role_id UUID;
BEGIN
  -- Seed the 5 default roles first
  PERFORM seed_default_roles(NEW.id);

  -- Grab the Owner role that was just seeded
  SELECT id INTO v_owner_role_id
  FROM org_roles
  WHERE org_id = NEW.id AND name = 'Owner'
  LIMIT 1;

  -- Auto-add the creator as an active Owner member
  -- SECURITY DEFINER means this bypasses all RLS policies
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO org_members (org_id, user_id, role_id, status, joined_at)
    VALUES (NEW.id, NEW.created_by, v_owner_role_id, 'active', now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. Fix is_org_member search path (prevents table not found in SECURITY DEFINER context)
CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;


-- 3. Fix get_user_permissions search path
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


-- 4. Fix has_permission search path
CREATE OR REPLACE FUNCTION has_permission(org_uuid UUID, perm TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (get_user_permissions(org_uuid) ->> perm)::BOOLEAN,
    false
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;


-- 5. Add a dedicated RPC to fetch user's orgs — bypasses all RLS
--    OrgContext will call this instead of querying org_members directly
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


-- ================================================================
-- 6. CRITICAL: Replace is_org_member() in RLS with direct subqueries
--    The circular dependency (is_org_member → queries org_members
--    which has RLS that calls is_org_member) causes tasks/projects
--    to be created but not visible.
--    Direct EXISTS subqueries always work correctly.
-- ================================================================

-- TASKS: replace is_org_member with direct subquery
DROP POLICY IF EXISTS "Members can view tasks" ON tasks;
CREATE POLICY "Members can view tasks"
  ON tasks FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = tasks.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ORG_MEMBERS: replace circular is_org_member with direct subquery
DROP POLICY IF EXISTS "Members can view org members" ON org_members;
CREATE POLICY "Members can view org members"
  ON org_members FOR SELECT USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ORG_ROLES: replace is_org_member with direct subquery
DROP POLICY IF EXISTS "Members can view org roles" ON org_roles;
CREATE POLICY "Members can view org roles"
  ON org_roles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = org_roles.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- PROJECTS: replace is_org_member with direct subquery
DROP POLICY IF EXISTS "Members can view projects" ON projects;
CREATE POLICY "Members can view projects"
  ON projects FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = projects.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- LABELS: replace is_org_member with direct subquery
DROP POLICY IF EXISTS "Members can view labels" ON labels;
CREATE POLICY "Members can view labels"
  ON labels FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = labels.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ACTIVITY_LOG: replace is_org_member with direct subquery
DROP POLICY IF EXISTS "Members can view activity" ON activity_log;
CREATE POLICY "Members can view activity"
  ON activity_log FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = activity_log.org_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- TASK_COMMENTS: replace is_org_member with direct subquery
DROP POLICY IF EXISTS "Members can view comments" ON task_comments;
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
