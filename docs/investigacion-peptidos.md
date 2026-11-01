# Investigación de péptidos · 31/10/2026

Base de datos de la biblioteca de peptalk: 40 péptidos con estado regulatorio por agencia, nivel de evidencia, resumen y referencias. La fuente de verdad es `research/peptides.json`; la web se genera con `python3 scripts/peptides.py`.

**Estado:** investigación preliminar hecha con agentes de IA sobre fuentes primarias. Ningún dato fue revisado todavía por un médico ni por peptalk lab. La web lo dice en cada ficha.

## Método

- **ANMAT:** Vademécum Nacional de Medicamentos (consulta pública), disposiciones del Boletín Oficial y la alerta de ANMAT del 04/09/2026 sobre inyectables con péptidos no autorizados. Que un péptido no aparezca en el VNM no prueba que no esté registrado: por eso esos casos llevan confianza media o baja, o quedan «Pendiente».
- **FDA:** Drugs@FDA / openFDA y las listas de sustancias a granel 503A/503B (actualizadas a abril-mayo de 2026). Las votaciones del comité PCAC de julio de 2026 salen de fuentes secundarias y la FDA todavía no decidió.
- **EMA:** EPAR de la EMA y, para autorizaciones nacionales, registros de países de la UE (por ejemplo, CIMA de la AEMPS). Regla: «Aprobado» incluye autorizaciones nacionales; la nota de cada ficha aclara cuál.
- **WADA:** Lista de Prohibiciones 2026 (vigente desde el 1/1/2026). Cuando el péptido no está nombrado y se aplicó S0 (sustancias sin aprobación de ninguna autoridad sanitaria), la nota lo explica.
- **Evidencia:** PubMed y ClinicalTrials.gov. A = ensayos controlados replicados, B = al menos un ensayo controlado, C = estudios en humanos sin control, D = solo preclínico, E = sin estudios. Mide qué tipo de evidencia hay, no si funciona: larazotida y cerebrolisina tienen A con resultados negativos o mixtos.
- **Referencias:** DOI y PMID verificados contra PubMed o Crossref durante la investigación. Algunos datos de volumen y página de lote 4 se escribieron de memoria: conviene revisarlos.

## Resumen

| Péptido | Sistema | ANMAT | FDA | EMA | WADA | Evidencia |
|---|---|---|---|---|---|---|
| BPC-157 | digestivo | No aprobado | No aprobado | No aprobado | Prohibido | C |
| Semaglutida | digestivo | Aprobado | Aprobado | Aprobado | No listado | A |
| TB-500 | huesos | No aprobado | No aprobado | No aprobado | Prohibido | D |
| GHK-Cu | piel | No aprobado | Cosmético | Cosmético | No listado | B |
| Tirzepatida | digestivo | Aprobado | Aprobado | Aprobado | No listado | A |
| Epitalon | piel | No aprobado | No aprobado | No aprobado | Prohibido | C |
| Timosina alfa-1 | inmune | Aprobado | No aprobado | Aprobado | No listado | B |
| Oxitocina | hormonas | Aprobado | Aprobado | Aprobado | No listado | A |
| KPV | digestivo | Pendiente | No aprobado | No aprobado | Prohibido | D |
| AOD-9604 | digestivo | No aprobado | No aprobado | No aprobado | Prohibido | B |
| Fragmento 176-191 | digestivo | Pendiente | No aprobado | No aprobado | Prohibido | D |
| Selank | cerebro | No aprobado | No aprobado | No aprobado | No listado | B |
| Semax | cerebro | No aprobado | No aprobado | No aprobado | No listado | B |
| DSIP | cerebro | No aprobado | No aprobado | No aprobado | No listado | B |
| Bremelanotida | sexual | No aprobado | Aprobado | No aprobado | No listado | A |
| Kisspeptina | sexual | No aprobado | En investigación | No aprobado | Prohibido | B |
| CJC-1295 | hormonas | No aprobado | No aprobado | No aprobado | Prohibido | B |
| Ipamorelina | hormonas | No aprobado | No aprobado | No aprobado | Prohibido | B |
| LL-37 | inmune | Pendiente | No aprobado | No aprobado | Prohibido | B |
| Palmitoil pentapéptido-4 | piel | Cosmético | Cosmético | Cosmético | No listado | B |
| Bivalirudina | corazon | Pendiente | Aprobado | Aprobado | No listado | A |
| Nesiritida | corazon | No aprobado | Aprobado | No aprobado | No listado | A |
| Abaloparatida | huesos | No aprobado | Aprobado | Aprobado | No listado | A |
| Argirelina (acetil hexapéptido) | piel | Pendiente | Cosmético | Cosmético | No listado | B |
| Cerebrolisina | cerebro | Aprobado | No aprobado | Pendiente | No listado | A |
| Desmopresina | hormonas | Aprobado | Aprobado | Aprobado | Prohibido | A |
| Dihexa | cerebro | Pendiente | No aprobado | No aprobado | Prohibido | D |
| GHRP-6 | hormonas | Pendiente | No aprobado | No aprobado | Prohibido | C |
| Hexarelina | hormonas | Pendiente | No aprobado | No aprobado | Prohibido | B |
| Larazotida | digestivo | Pendiente | En investigación | No aprobado | Prohibido | A |
| Leuprorelina | sexual | Aprobado | Aprobado | Aprobado | Prohibido | A |
| Liraglutida | digestivo | Aprobado | Aprobado | Aprobado | No listado | A |
| Melanotan II | piel | No aprobado | No aprobado | No aprobado | Prohibido | B |
| MOTS-c | hormonas | No aprobado | No aprobado | No aprobado | Prohibido | D |
| Octreotida | hormonas | Aprobado | Aprobado | Aprobado | No listado | A |
| Retatrutida | digestivo | En investigación | En investigación | En investigación | Prohibido | A |
| Sermorelina | hormonas | Pendiente | Aprobado | No aprobado | Prohibido | B |
| Setmelanotida | digestivo | No aprobado | Aprobado | Aprobado | No listado | B |
| Teriparatida | huesos | Aprobado | Aprobado | Aprobado | No listado | A |
| Tesamorelina | hormonas | Pendiente | Aprobado | No aprobado | Prohibido | A |

## Para confirmar antes de darlo por revisado

Estados en «Pendiente» o con confianza baja/media según quien investigó:

- **BPC-157** · FDA: No aprobado (media) · EMA: No aprobado (media)
- **TB-500** · FDA: No aprobado (media) · EMA: No aprobado (media)
- **GHK-Cu** · ANMAT: No aprobado (media) · FDA: Cosmético (media) · EMA: Cosmético (media) · WADA: No listado (baja)
- **Epitalon** · FDA: No aprobado (media) · EMA: No aprobado (media) · WADA: Prohibido (media)
- **Timosina alfa-1** · EMA: Aprobado (media)
- **KPV** · ANMAT: Pendiente (baja) · FDA: No aprobado (media) · EMA: No aprobado (media) · WADA: Prohibido (media)
- **AOD-9604** · FDA: No aprobado (media) · EMA: No aprobado (media)
- **Fragmento 176-191** · ANMAT: Pendiente (baja) · FDA: No aprobado (media) · EMA: No aprobado (media)
- **Selank** · ANMAT: No aprobado (media) · EMA: No aprobado (media) · WADA: No listado (media)
- **Semax** · ANMAT: No aprobado (media) · EMA: No aprobado (media) · WADA: No listado (media)
- **DSIP** · ANMAT: No aprobado (media) · EMA: No aprobado (media) · WADA: No listado (media)
- **Bremelanotida** · ANMAT: No aprobado (media) · EMA: No aprobado (media)
- **Kisspeptina** · ANMAT: No aprobado (media) · EMA: No aprobado (media)
- **CJC-1295** · ANMAT: No aprobado (media) · EMA: No aprobado (media)
- **Ipamorelina** · ANMAT: No aprobado (media) · EMA: No aprobado (media)
- **LL-37** · ANMAT: Pendiente (baja) · FDA: No aprobado (media) · EMA: No aprobado (media) · WADA: Prohibido (media)
- **Palmitoil pentapéptido-4** · ANMAT: Cosmético (baja) · FDA: Cosmético (media) · EMA: Cosmético (media)
- **Bivalirudina** · ANMAT: Pendiente (baja) · EMA: Aprobado (media)
- **Nesiritida** · ANMAT: No aprobado (media) · EMA: No aprobado (media)
- **Abaloparatida** · ANMAT: No aprobado (media)
- **Argirelina (acetil hexapéptido)** · ANMAT: Pendiente (baja) · FDA: Cosmético (media) · WADA: No listado (baja)
- **Cerebrolisina** · ANMAT: Aprobado (media) · EMA: Pendiente (baja) · WADA: No listado (media)
- **Desmopresina** · EMA: Aprobado (media)
- **Dihexa** · ANMAT: Pendiente (baja) · EMA: No aprobado (media) · WADA: Prohibido (media)
- **GHRP-6** · ANMAT: Pendiente (baja) · EMA: No aprobado (media)
- **Hexarelina** · ANMAT: Pendiente (baja) · FDA: No aprobado (media) · EMA: No aprobado (media)
- **Larazotida** · ANMAT: Pendiente (baja) · FDA: En investigación (media) · EMA: No aprobado (media) · WADA: Prohibido (baja)
- **Melanotan II** · WADA: Prohibido (media)
- **MOTS-c** · ANMAT: No aprobado (media) · FDA: No aprobado (media) · EMA: No aprobado (media)
- **Octreotida** · EMA: Aprobado (media)
- **Retatrutida** · ANMAT: En investigación (media) · FDA: En investigación (media) · EMA: En investigación (media) · WADA: Prohibido (media)
- **Sermorelina** · ANMAT: Pendiente (baja) · EMA: No aprobado (media)
- **Setmelanotida** · ANMAT: No aprobado (media) · WADA: No listado (media)
- **Tesamorelina** · ANMAT: Pendiente (baja)

## Decisiones abiertas

1. **Criterio EMA:** hoy cuenta autorizaciones nacionales (afecta oxitocina, bivalirudina, timosina alfa-1, octreotida, desmopresina). Si se quiere «solo autorización centralizada», bivalirudina y timosina alfa-1 pasan a «No aprobado».
2. **Aprobaciones históricas:** sermorelina figura «Aprobado» en FDA por Geref, discontinuada en 2008. Se podría sumar un estado «Discontinuado».
3. **FDA y PCAC:** en julio de 2026 el comité recomendó sumar BPC-157, TB-500, KPV, Epitalon y MOTS-c a la lista 503A. Cuando la FDA decida, hay que actualizar esas fichas.
4. **Lista WADA 2027:** entra en vigor el 1/1/2027. Hay que revisar los 40 estados en enero.
5. **ANMAT:** confirmar con consulta directa al VNM o a ANMAT los casos «Pendiente» (KPV, LL-37, fragmento 176-191, GHRP-6, hexarelina, dihexa, larazotida, argirelina, sermorelina, tesamorelina, bivalirudina).
