-- Documents written by agents and by Kinika in the workspace, and notes in task conversations.
alter table documents drop constraint if exists documents_document_type_check;
alter table documents add constraint documents_document_type_check check (document_type = any (array[
  'pitch_deck','client_proposal','one_pager','rate_card','case_study','project_brief','invoice_cover_letter','partnership_proposal',
  'agent_output','kinika_output'
]));
alter table mentor_messages drop constraint if exists mentor_messages_role_check;
alter table mentor_messages add constraint mentor_messages_role_check check (role = any (array['user','assistant','note']));
