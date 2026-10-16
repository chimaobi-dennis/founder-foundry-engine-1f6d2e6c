-- "Send back for changes": the agent revises with the founder's note and comes back for approval.
alter table approvals drop constraint if exists approvals_status_check;
alter table approvals add constraint approvals_status_check check (status = any (array['pending','approved','rejected','revise']));
