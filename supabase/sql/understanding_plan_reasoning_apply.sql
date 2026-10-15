-- Understanding and plan building are long, careful work: route them through the reasoning class.
update ai_task_types set class_slug = 'reasoning', description = 'Reads what a founder said, their site and documents, and writes back the business as Kinika understands it.' where task_type = 'understanding';
update ai_task_types set class_slug = 'reasoning', description = 'Builds or revises the founder plan from the brand context.' where task_type = 'plan_build';
