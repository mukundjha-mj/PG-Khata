CREATE POLICY "tenant_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tenant-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tenant_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tenant_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tenant-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tenant_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-documents' AND (storage.foldername(name))[1] = auth.uid()::text);