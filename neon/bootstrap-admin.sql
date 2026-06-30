-- Run this manually in Neon SQL Editor after your first account signs up.
-- Replace the email before running.

update public.app_users
set role = 'admin'
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');

select id, display_name, email, role
from public.app_users
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
