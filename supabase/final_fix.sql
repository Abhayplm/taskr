-- =================================================================
-- COMPREHENSIVE FIX — Run this ENTIRE file in Supabase SQL Editor
-- Fixes: admin access, task visibility, profiles, circular RLS
-- =================================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. SET ADMIN — disable triggers for this session, do the update
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- session_replication_role=replica disables ALL triggers globally
-- for this session — guaranteed to bypass check_profile_update.
SET session_replication_role = replica;

UPDATE profiles
SET is_system_admin = true
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'prakashabhay5@gmail.com'
  LIMIT 1
);

RESET session_replication_role;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. SECURITY DEFINER RPC for admin check
--    Admin page will call this instead of querying profiles directly.
--    Bypasses all RLS — always returns the real value.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION check_is_system_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_system_admin, false)
  FROM profiles
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- Also fix the trigger so future SQL Editor runs work without this workaround
CREATE OR REPLACE FUNCTION check_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_system_admin IS NOT DISTINCT FROM OLD.is_system_admin THEN
    RETURN NEW; -- no change, skip
  END IF;
  -- Allow postgres superuser / SQL Editor (auth.uid() IS NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Only an existing admin can promote another user
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_system_admin = true
  ) THEN
    NEW.is_system_admin = OLD.is_system_admin;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. FIX ALL CIRCULAR / BROKEN RLS POLICIES
--    Replace every is_org_member() call and every self-referential
--    subquery with direct EXISTS checks that never recurse.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Helper: is_active_member — SECURITY DEFINER so it can query
-- org_members without applying org_members' own RLS policy.
CREATE OR REPLACE FUNCTION is_active_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid AND user_id = auth.uid() AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- ── ORGANIZATIONS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view their orgs" ON organizations;
CREATE POLICY "Members can view their orgs"
  ON organizations FOR SELECT USING (
    created_by = auth.uid()
    OR is_active_member(organizations.id)
  );

-- ── PROFILES ───────────────────────────────────────────────────
-- Allow viewing your own profile AND profiles of people in your orgs
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view same-org profiles" ON profiles;
CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_members om1
      WHERE om1.user_id = auth.uid() AND om1.status = 'active'
        AND EXISTS (
          SELECT 1 FROM org_members om2
          WHERE om2.org_id = om1.org_id AND om2.user_id = profiles.id
        )
    )
  );

-- ── ORG_ROLES ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view org roles" ON org_roles;
CREATE POLICY "Members can view org roles"
  ON org_roles FOR SELECT USING (is_active_member(org_id));

-- ── ORG_MEMBERS ─────────────────────────────────────────────────
-- Self-referential subquery in the old policy caused recursion.
-- New policy: users see their own row + rows in orgs they belong to.
DROP POLICY IF EXISTS "Members can view org members" ON org_members;
CREATE POLICY "Members can view org members"
  ON org_members FOR SELECT USING (
    user_id = auth.uid()
    OR is_active_member(org_id)
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ── TASKS ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view tasks" ON tasks;
CREATE POLICY "Members can view tasks"
  ON tasks FOR SELECT USING (is_active_member(org_id));

DROP POLICY IF EXISTS "Permitted users can create tasks" ON tasks;
CREATE POLICY "Permitted users can create tasks"
  ON tasks FOR INSERT WITH CHECK (is_active_member(org_id));

-- ── PROJECTS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view projects" ON projects;
CREATE POLICY "Members can view projects"
  ON projects FOR SELECT USING (is_active_member(org_id));

-- ── LABELS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view labels" ON labels;
CREATE POLICY "Members can view labels"
  ON labels FOR SELECT USING (is_active_member(org_id));

-- ── TASK_LABELS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view task labels" ON task_labels;
CREATE POLICY "Members can view task labels"
  ON task_labels FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_labels.task_id AND is_active_member(t.org_id)
    )
  );

DROP POLICY IF EXISTS "Permitted users can manage task labels" ON task_labels;
CREATE POLICY "Permitted users can manage task labels"
  ON task_labels FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_labels.task_id AND is_active_member(t.org_id)
    )
  );

-- ── TASK_COMMENTS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view comments" ON task_comments;
CREATE POLICY "Members can view comments"
  ON task_comments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id AND is_active_member(t.org_id)
    )
  );

DROP POLICY IF EXISTS "Members can create comments" ON task_comments;
CREATE POLICY "Members can create comments"
  ON task_comments FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id AND is_active_member(t.org_id)
    )
  );

-- ── ACTIVITY_LOG ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view activity" ON activity_log;
CREATE POLICY "Members can view activity"
  ON activity_log FOR SELECT USING (is_active_member(org_id));

DROP POLICY IF EXISTS "Members can insert activity" ON activity_log;
CREATE POLICY "Members can insert activity"
  ON activity_log FOR INSERT WITH CHECK (is_active_member(org_id));

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. DATA FIX — repair null role_ids for org creators
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. UPDATE get_my_orgs RPC (refresh existing)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. VERIFY everything worked
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  u.email,
  p.is_system_admin,
  p.full_name
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'prakashabhay5@gmail.com';
