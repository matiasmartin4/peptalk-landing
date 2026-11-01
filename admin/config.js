/* Conexión del backoffice con Supabase. La clave publishable es pública por diseño:
   lo que cada usuario puede ver o tocar lo deciden los permisos de la base (RLS).
   Vacío = modo demo. */
window.PT_ADMIN = {
  supabaseUrl: 'https://ksclxrhwaeddlxrdnfxi.supabase.co',
  supabaseAnonKey: 'sb_publishable_l8XJpJCka3c41SjeYNMjYQ_gGEtK3Zh'
};
