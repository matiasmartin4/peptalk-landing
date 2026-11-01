/* peptalk — datos de la biblioteca.
   Es la única fuente de contenido: para sumar un péptido, verificar un estado
   o cargar evidencia se edita este archivo. Estados sin verificar = 'Pendiente'.
   Cada estado verificado debería llevar fuente y fecha (campo `verified`). */

window.PT = {
  // zones: esferas [x, y, z, radio] en metros sobre el cuerpo 3D (pies en y=0, alto 1,8).
  // La primera zona es donde va el marcador del sistema.
  systems: [
    { id: 'cerebro',   name: 'Cerebro y sueño', zones: [[0, 1.66, 0.02, 0.15]],  desc: 'Péptidos que se estudian en sueño, ansiedad, memoria y neuroprotección.',            icon: 'brain' },
    { id: 'hormonas',  name: 'Hormonas y metabolismo', zones: [[0, 1.5, 0.05, 0.07], [0, 1.08, 0.06, 0.08]],  desc: 'Señales hormonales: hormona de crecimiento, oxitocina y el eje hipotálamo-hipófisis.', icon: 'flask-conical' },
    { id: 'inmune',    name: 'Inmune y defensa', zones: [[0, 1.36, 0.08, 0.08], [-0.15, 1.33, 0, 0.06], [0.15, 1.33, 0, 0.06], [-0.09, 0.88, 0.07, 0.06], [0.09, 0.88, 0.07, 0.06]], desc: 'Moduladores de la respuesta inmune y péptidos antimicrobianos.',                     icon: 'shield-plus' },
    { id: 'corazon',   name: 'Corazón y sangre', zones: [[0.04, 1.29, 0.08, 0.1]], desc: 'Anticoagulantes, péptidos natriuréticos y otros con uso cardiovascular.',             icon: 'heart-pulse' },
    { id: 'digestivo', name: 'Digestivo y peso', zones: [[0, 1.06, 0.07, 0.16]], desc: 'Agonistas de GLP-1, péptidos gástricos y los que se estudian en peso corporal.',        icon: 'apple' },
    { id: 'sexual',    name: 'Sexual y reproductivo', zones: [[0, 0.86, 0.08, 0.09]], desc: 'Péptidos vinculados al deseo, la fertilidad y el eje reproductivo.',                  icon: 'venus-and-mars' },
    { id: 'piel',      name: 'Piel y envejecimiento', zones: [[-0.24, 1.02, 0.02, 0.13], [0.24, 1.02, 0.02, 0.13], [0, 1.64, 0.1, 0.12]], desc: 'Péptidos cosméticos y los que se estudian en cicatrización y envejecimiento.',         icon: 'sparkles' },
    { id: 'huesos',    name: 'Huesos y músculo', zones: [[-0.1, 0.5, 0.03, 0.1], [0.1, 0.5, 0.03, 0.1], [-0.2, 1.42, 0, 0.08], [0.2, 1.42, 0, 0.08]], desc: 'Reparación de tendones, músculo y hueso, en su mayoría con evidencia preclínica.',     icon: 'bone' }
  ],

  // peptides: se cargan desde peptides.js (generado por scripts/peptides.py desde research/peptides.json)


  // Fichas que rotan en la tarjeta del hero.
  featured: ['bpc-157', 'semaglutida', 'tb-500', 'ghk-cu'],

  agencies: ['ANMAT', 'FDA', 'EMA', 'WADA'],
  agencyInfo: {
    ANMAT: { name: 'Argentina', icon: 'building-2' },
    FDA: { name: 'Estados Unidos', icon: 'globe' },
    EMA: { name: 'Unión Europea', icon: 'globe' },
    WADA: { name: 'Antidopaje', icon: 'trophy' }
  },

  // label → clase del punto + explicación
  statuses: [
    { v: 'Aprobado',         cls: 'd-aprob',  desc: 'Autorizado para al menos una indicación.' },
    { v: 'En investigación', cls: 'd-inv',    desc: 'Hay ensayos en curso; no está autorizado.' },
    { v: 'No aprobado',      cls: 'd-noap',   desc: 'Sin autorización para uso en personas.' },
    { v: 'Prohibido',        cls: 'd-proh',   desc: 'En la lista de sustancias prohibidas (WADA).' },
    { v: 'Cosmético',        cls: 'd-cosm',   desc: 'Registrado como ingrediente cosmético.' },
    { v: 'No listado',       cls: 'd-nolist', desc: 'La agencia no tiene registro sobre él.' },
    { v: 'Pendiente',        cls: 'd-pend',   desc: 'Todavía no lo confirmamos con una fuente primaria.' }
  ],

  evidence: [
    { v: 'A', name: 'Ensayos controlados replicados' },
    { v: 'B', name: 'Al menos un ensayo controlado' },
    { v: 'C', name: 'Estudios humanos no controlados' },
    { v: 'D', name: 'Solo preclínico' },
    { v: 'E', name: 'Sin estudios publicados' },
    { v: '—', name: 'Evidencia pendiente de revisión' }
  ],

  provinces: ['Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'],

  // Base del backoffice (Supabase). Los formularios guardan con la función pt_submit_lead;
  // la clave publishable es pública por diseño. Vacío = el formulario valida pero avisa que todavía no recibe pedidos.
  supabase: { url: 'https://ksclxrhwaeddlxrdnfxi.supabase.co', anonKey: 'sb_publishable_l8XJpJCka3c41SjeYNMjYQ_gGEtK3Zh' }
};
