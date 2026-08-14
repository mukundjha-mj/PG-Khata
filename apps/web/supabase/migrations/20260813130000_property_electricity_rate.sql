-- Per-property electricity rate override. Null means "use my Settings
-- default" - existing properties are unaffected until the owner sets one.
ALTER TABLE public.properties
  ADD COLUMN electricity_rate_per_unit NUMERIC(10,2);
