-- Set prakashabhay5@gmail.com as system admin
-- The check_profile_update trigger blocks this when auth.uid() is NULL (SQL Editor context).
-- We must disable it temporarily, update, then re-enable.

-- Step 1: Disable the guard trigger
ALTER TABLE profiles DISABLE TRIGGER tr_check_profile_update;

-- Step 2: Set is_system_admin = true
UPDATE profiles
SET is_system_admin = true
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'prakashabhay5@gmail.com'
  LIMIT 1
);

-- Step 3: Re-enable the trigger
ALTER TABLE profiles ENABLE TRIGGER tr_check_profile_update;

-- Step 4: Verify — should show is_system_admin = true
SELECT p.id, u.email, p.is_system_admin
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'prakashabhay5@gmail.com';
