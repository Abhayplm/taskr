-- =============================================
-- Fix RLS Policies for org_members
-- Run this in your Supabase SQL Editor
-- =============================================

-- Drop the old SELECT policy and recreate it using auth.jwt() ->> 'email'
DROP POLICY IF EXISTS "Members can view org members" ON org_members;

CREATE POLICY "Members can view org members"
  ON org_members FOR SELECT
  USING (
    is_org_member(org_id)
    OR invited_email = (auth.jwt() ->> 'email')
  );

-- Drop the old UPDATE policy and recreate it using auth.jwt() ->> 'email'
DROP POLICY IF EXISTS "Invited users can accept their invites" ON org_members;

CREATE POLICY "Invited users can accept their invites"
  ON org_members FOR UPDATE
  USING (
    invited_email = (auth.jwt() ->> 'email')
    AND status = 'pending'
  );
