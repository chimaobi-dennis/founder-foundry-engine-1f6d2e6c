-- Align agents.suited_stages with the journey_stages keys the app uses
-- (spark, shape, validate, brand, launch, grow). The seed used a guessed
-- vocabulary; Mentor's recommendations match on these keys.

UPDATE public.agents SET suited_stages = ARRAY['brand', 'launch', 'grow']            WHERE slug = 'copywriter';
UPDATE public.agents SET suited_stages = ARRAY['brand', 'launch', 'grow']            WHERE slug = 'designer';
UPDATE public.agents SET suited_stages = ARRAY['spark', 'shape', 'validate', 'brand'] WHERE slug = 'researcher';
