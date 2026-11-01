/* Conexión del backoffice con Supabase. La clave "anon" es pública por diseño:
   lo que cada usuario puede ver o tocar lo deciden los permisos de la base (RLS).
   Vacío = modo demo. */
window.PT_ADMIN = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
