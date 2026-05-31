-- Superadmin puede gestionar plantillas (leer todas, insertar, actualizar, eliminar)

CREATE POLICY "superadmin_templates_read_all" ON public.templates
  FOR SELECT
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

CREATE POLICY "superadmin_templates_insert" ON public.templates
  FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

CREATE POLICY "superadmin_templates_update" ON public.templates
  FOR UPDATE
  USING  ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin')
  WITH CHECK ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

CREATE POLICY "superadmin_templates_delete" ON public.templates
  FOR DELETE
  USING ((SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin');

-- Storage: superadmin sube, actualiza y borra en el bucket templates
CREATE POLICY "superadmin_templates_storage_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'templates' AND
    (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
  );

CREATE POLICY "superadmin_templates_storage_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'templates' AND
    (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
  );

CREATE POLICY "superadmin_templates_storage_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'templates' AND
    (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'superadmin'
  );
