-- Plan copy on credit_packages, aligned with the locked framing (seats vs credits, review on everything).
update credit_packages set
  tagline = 'For one founder with a plan to run.',
  description = 'Two agent seats, 1,000 credits a month. Kinika hires one role at a time and swaps when a role is done. You approve every result.'
where slug = 'solo';
update credit_packages set
  tagline = 'For a small team running real work through Kinika.',
  description = 'Five agent seats, 2,000 credits a month, people in the workspace, standing tasks on a schedule.'
where slug = 'startup';
update credit_packages set
  tagline = 'For teams and agencies running more than one business.',
  description = 'Ten agent seats, several businesses, 6,000 credits a month, twenty people, act-without-asking on kinds of action you choose.'
where slug = 'enterprise';
update credit_packages set
  description = 'One more seat on Kinika''s team, any role, with 250 credits a month.'
where slug = 'agent_seat';
