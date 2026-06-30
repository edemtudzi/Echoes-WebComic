-- Run this manually in the Supabase SQL editor after your first admin user signs up.
-- Replace the email before running.

update public.profiles
set role = 'admin'
where email = 'YOUR_ADMIN_EMAIL@example.com';

select id, display_name, email, role
from public.profiles
where email = 'YOUR_ADMIN_EMAIL@example.com';
