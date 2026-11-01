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
    { id: 'piel',      name: 'Piel y envejecimiento', zones: [[-0.27, 1.0, 0.02, 0.14], [0.27, 1.0, 0.02, 0.14], [0, 1.64, 0.1, 0.12]], desc: 'Péptidos cosméticos y los que se estudian en cicatrización y envejecimiento.',         icon: 'sparkles' },
    { id: 'huesos',    name: 'Huesos y músculo', zones: [[-0.1, 0.5, 0.03, 0.1], [0.1, 0.5, 0.03, 0.1], [-0.2, 1.42, 0, 0.08], [0.2, 1.42, 0, 0.08]], desc: 'Reparación de tendones, músculo y hueso, en su mayoría con evidencia preclínica.',     icon: 'bone' }
  ],

  peptides: [
    { slug: 'bpc-157', name: 'BPC-157', alias: 'Body Protection Compound-157 · PL 14736', sys: 'digestivo', type: 'Péptido' },
    { slug: 'semaglutida', name: 'Semaglutida', alias: 'Semaglutide', sys: 'digestivo', type: 'Análogo peptídico' },
    { slug: 'tb-500', name: 'TB-500', alias: 'Fragmento de timosina beta-4', sys: 'huesos', type: 'Péptido' },
    { slug: 'ghk-cu', name: 'GHK-Cu', alias: 'Tripéptido de cobre-1', sys: 'piel', type: 'Péptido' },
    { slug: 'tirzepatida', name: 'Tirzepatida', alias: 'Tirzepatide', sys: 'digestivo', type: 'Análogo peptídico' },
    { slug: 'epitalon', name: 'Epitalon', alias: 'Epithalon · AEDG', sys: 'piel', type: 'Péptido' },
    { slug: 'timosina-alfa-1', name: 'Timosina alfa-1', alias: 'Thymosin alpha-1 · Timalfasina', sys: 'inmune', type: 'Péptido' },
    { slug: 'oxitocina', name: 'Oxitocina', alias: 'Oxytocin', sys: 'hormonas', type: 'Péptido' },
    { slug: 'kpv', name: 'KPV', alias: 'Lys-Pro-Val', sys: 'digestivo', type: 'Péptido' },
    { slug: 'aod-9604', name: 'AOD-9604', alias: 'Fragmento modificado de hGH', sys: 'digestivo', type: 'Péptido' },
    { slug: 'fragmento-176-191', name: 'Fragmento 176-191', alias: 'HGH Fragment 176-191', sys: 'digestivo', type: 'Péptido' },
    { slug: 'selank', name: 'Selank', alias: 'TP-7', sys: 'cerebro', type: 'Péptido' },
    { slug: 'semax', name: 'Semax', alias: 'ACTH(4-7)-PGP', sys: 'cerebro', type: 'Péptido' },
    { slug: 'dsip', name: 'DSIP', alias: 'Delta sleep-inducing peptide', sys: 'cerebro', type: 'Péptido' },
    { slug: 'bremelanotida', name: 'Bremelanotida', alias: 'PT-141 · Bremelanotide', sys: 'sexual', type: 'Péptido' },
    { slug: 'kisspeptina', name: 'Kisspeptina', alias: 'Kisspeptin-10', sys: 'sexual', type: 'Péptido' },
    { slug: 'cjc-1295', name: 'CJC-1295', alias: 'Análogo de GHRH', sys: 'hormonas', type: 'Análogo peptídico' },
    { slug: 'ipamorelina', name: 'Ipamorelina', alias: 'Ipamorelin', sys: 'hormonas', type: 'Péptido' },
    { slug: 'll-37', name: 'LL-37', alias: 'Catelicidina', sys: 'inmune', type: 'Péptido' },
    { slug: 'palmitoil-pentapeptido-4', name: 'Palmitoil pentapéptido-4', alias: 'Matrixyl · Pal-KTTKS', sys: 'piel', type: 'Cosmético' },
    { slug: 'bivalirudina', name: 'Bivalirudina', alias: 'Bivalirudin', sys: 'corazon', type: 'Péptido' },
    { slug: 'nesiritida', name: 'Nesiritida', alias: 'Nesiritide · BNP recombinante', sys: 'corazon', type: 'Polipéptido' }
  ],

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
    { v: 'Pendiente',        cls: 'd-pend',   desc: 'Todavía no lo verificó peptalk lab.' }
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

  // Endpoints de formularios (Formspree, Google Apps Script, etc.).
  // Vacío = el formulario valida pero avisa que todavía no recibe pedidos.
  endpoints: { newsletter: '', referral: '' }
};
