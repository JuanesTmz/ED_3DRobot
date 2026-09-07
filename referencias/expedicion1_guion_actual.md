# Expedición 1 · La IA no sabe quién eres

> Volcado actualizado de lo que hoy corre en `docs/charla.html` (el array `script`,
> sección `EXPEDICIÓN 1`), con la misma notación `{{...}}` que usas en tu `personaje.md`
> para marcar animaciones/tablero, y agregando `{{Emote: ...}}` para los gestos de K-7.
> Edítalo y agrega más `{{...}}` donde quieras — luego lo paso de vuelta al código.
>
> Convenciones:
> - **K-7 dice:** / **Vero dice:** → texto tal cual aparece en la caja de diálogo.
> - `[Campo abierto: nombre]` → el docente escribe libre.
> - `[Opciones]` → botones de respuesta cerrada, cada uno con su réplica.
> - `{{Emote: K7_X}}` → K-7 hace ese gesto (ver tabla de gestos al final) mientras dice esa línea.
> - `{{Muestra imagen en tablero: archivo.png}}` / `{{Vuelve a K7}}` → zoom de cámara al tablero y de regreso.
> - `{{Sigue en el tablero}}` → el mensaje comparte la pizarra que ya estaba abierta (no vuelve a hacer zoom).

---

## Encabezado del capítulo

**Título:** Expedición 1 · La IA no sabe quién eres
**Nota:** K-7 tiene toda la información del mundo y ni una sola pista sobre tu salón. Empieza por ahí.

---

## 1.1 — K-7 se presenta

**K-7 dice**, en mensajes seguidos:
1. Buenas tardes, profe. ¿Me conoce? Soy **K-7**.
2. Si lo lee en voz alta, puede sonar parecido a Q-7, incluso a C-7. Pero es **K-7**.
   No lo olvide, por favor. K, como la vitamina K. Y el 7, como los días de la semana.
3. Espero que no le incomode, pero tengo algo que decirle: quiero ser como usted.
4. Le podrá parecer excesivo, más si no me conoce, pero verá: tengo acceso a una cantidad enorme de información, ni usted podría adivinar cuánta.
5. Pero por más que acumulo y acumulo, nunca será suficiente para ser docente.
6. ¡Por eso tiene mi admiración!
7. Y por favor, no se ría de mí, pero *me gustaría ser profe*, como usted.

**[Campo abierto: `presentacion`]**
Ahora sabe algo esencial de mí, y no cualquier cosa. La gente poco va por ahí saludándose y diciendo: «mi gran sueño es este». Por simple equidad, ¿le parece bien si me cuenta **cuál es su nombre** y algo de usted que considere importante? Por ejemplo: ¿cuál es su gran sueño?
Placeholder: *Su nombre y algo importante sobre usted…*

*(De aquí también se saca el nombre con el que K-7 le habla al docente el resto de la charla.)*

---

## 1.1 (continuación)

`{{Emote: K7_Triste, solo si dejó `presentacion` en blanco}}`

**[Respuesta dinámica]** — según si el docente escribió algo:
- **En blanco:** «Prefiere guardárselo. Lo komprendo, y k-créame que lo respeto: no todo lo que importa se entrega en el primer saludo.»
- **Con respuesta:** «Encantado, **[nombre]**. Y no se ría: acabo de archivar esa frase suya —«[cita]»— en el único lugar donde guardo lo que no puedo deducir por mi cuenta.
  Es poco lo que dice, y aun así no había en toda la red una sola línea que me lo dijera. ¡Recáspita!»

**K-7 dice**, seguido:
1. Ahora, para no quedarme solo en intenciones, me tomé la libertad de preparar mi primer ejercicio de clase. Es de matemáticas. Estudiantes de **quinto grado**. **Medellín**. ¡Un clásico! ¿Eh?
2. ¿Cómo lo hice? Esto es importante: revisé miles de planes de estudio en la web y calculé un caso impecable. Sé que mi lógica está bien, pero en los primeros análisis de viabilidad que he hecho parece que no funciona.
3. ¡Puf! Los humanos son tan complicados e impredecibles…

`{{Muestra imagen en tablero: Actividad1.1.png}}`
K-7 dice, ya con la pizarra abierta: «Aquí está el borrador en pantalla.»

`{{Vuelve a K7}}` — explica en texto lo que se veía en la imagen:
> **Fracciones y sus aplicaciones · sistemas de trenes de alta velocidad**
> 1. El Corredor del Nordeste de Amtrak tiene *3/4* de su longitud electrificada. Si el corredor mide 457 millas, ¿cuántas millas no están electrificadas?
> 2. De la flota Acela Express, *1/2* está en servicio activo. Si hay 28 trenes en total, ¿cuántos están en servicio?

**[Opciones]** — Mírelo con ojos de maestro y dígame con total franqueza: **¿usaría esta clase para su próxima clase?**

| Opción del docente | Réplica de K-7 |
|---|---|
| La verdad no, K-7. Sí, se ve ordenada, pero en un salón real aquí en Medellín nadie conectaría con eso. | Ya veo, profe. Lo que usted identifikkka es entonces un problema de **kkkontexto**. Bueno, quizá sí, y en el papel se ve prolijo, pero en un salón real sería un desastre. |
| No lo tengo tan claro. Es posible, pero si se tratara de mis estudiantes, diría que le falta conexión con sus vidas. | Me lleva el que me trajo. Puedo calcular que en su respuesta la palabra que más peso tiene es **kkkonexión**. Mi sistema no la detekkktó, pero usted tiene ventaja sobre mí en identificar ese tipo de variables. ¿Lo sabía? |
| Sí, puede que funcione. Pero, ¿a qué quieres llegar con todo eso? | Vea pues. Como le kkkkomenté antes, quiero ser docente, pero nunca es suficiente. Este ejercicio ya lo probé y parece kkkue simplemente… no conekkkta. |

---

## 1.2 — K-7 reconoce el problema de contexto

**K-7 dice**, seguido:
1. ¿Sabe algo? Cuando me pongo nervioso se me salen las «k».
2. Tal vez kkkkuando señala el contexto o la conexión puede que esté relacionado con que el ejercicio se desarrolla en Estados Unidos, en millas, y en un salón de clases muy diferente a lo que se enkkkkuentra en Medellín.
3. `{{Emote: K7_Pensando}}` Y ya que ando reconociendo problemas, debo decirle otra kkkkosa.
4. Yo sé operar frakkkk-ciones, pero no sé qué son ni para qué sirven las matemáticas, ya sabe, en la vida real.
5. ¿Qué tienen que ver con el Metro, o cómo las usa una mamá que va a hacer merkkkkado?
6. Es que usted ve cosas que ningún algoritmo puede procesar, o mejor debería decir… *¿sentir?*
7. Profe (¿puedo decirle profe?), dígame algo…
8. ¡Profe! ¡Já! Es que se siente tan bien decirle «profe».
9. `{{Emote: K7_Saltito x2 — un saltito ladeado a la izquierda y otro idéntico a la derecha}}` Profe, profe, profe, profe, profe, profe, profe, profe, profe…

**[Campo abierto: `ajuste`]**
¿Kkkkué le cambio a este ejercicio para que funcione en un aula como la suya?
Placeholder: *Qué le cambiaría al ejercicio…*

---

## 1.3 — K-7 entiende el error

**[Respuesta dinámica]** — según `ajuste`:
- **En blanco:** «Lo dejo pensando, ya veo. Eso también es un dato, profe.»
- **Con respuesta:** ««[cita]»
  Anotado, profe. Ninguno de mis miles de planes de estudio traía esa instrucción, y usted me la dio en una sola frase.»

**K-7 dice**, seguido:
1. `{{Emote: K7_Pensando}}` Creo… creo que entiendo, profe. Estoy intentando resolver esto como si cambiara una variable en una ecuación. **Diseñé esa clase para un estudiante que no existe en Medellín.**
2. A las IA nos pasa eso mucho. ¿Si lo sabía? Eso sí, no todas son iguales. Por cierto, ¿conoce a la **profe Vero**? Ella trabaja con la IA de Escuela Inteligente. Luego se la presento. Ya viene en camino. ¡Es lo máximo!

**[Campo abierto: `estudiantes`]**
Por ahora, creo que tengo una idea. Pero antes de contársela, le propongo algo: hagamos un experimento.
Profe, dígame… **¿quiénes son sus estudiantes?** Ya sabe, nada de datos personales que los ponga en riesgo; mejor algo general, pero suficiente, que los describa bien.
Placeholder: *Quiénes son sus estudiantes…*

---

## 1.4 — K-7 pide el rumbo

**[Respuesta dinámica]** — según `estudiantes`:
- **En blanco:** «¡Uh! Ni una palabra, profe. Y aun así aprendo algo: hay cosas de un salón que no se entregan a la primera, ni siquiera a una IA bien intencionada.»
- **Con respuesta:** «¡Uh! Eso kkkue acaba de contarme —«[cita]»— no está en ningún repositorio.»

**K-7 dice**, seguido:
1. Déjeme decirle algo: **solo usted kkkonoce a sus estudiantes** a ese nivel.
2. Sus ritmos, su contexto… eso es esencial para que la kkklase funcione.
3. Yo puedo procesar miles de datos, pero no tengo ojos en el aula ni kkkriterio pedagógico.
4. Por eso es un error kkkuando pretendo dar una clase por mi cuenta, ya sabe, sin un profe.
5. `{{Emote: K7_HighFive}}` Hagámoslo bien esta vez, trabajemos juntos. ¿Se anima?

**[Campo abierto: `rumbo`]**
Deme usted el rumbo, dígame qué situación o enfoque usar, y yo me encargo de reconstruir la actividad de los fraccionarios.
Aquí viene mi lluvia de preguntas: ¿quiénes son sus estudiantes? ¿qué necesitan? ¿dónde viven? ¿qué les interesa? ¿qué problemas tienen?
Profe, incluya todo lo que considere pertinente, que yo haré mi mejor esfuerzo.
Placeholder: *El rumbo de la clase: situación, enfoque, intereses…*

---

## 1.5 — La clase reconstruida y la llegada de Vero

`{{Muestra imagen en tablero: Actividad1.2.png}}`
**[Respuesta dinámica, dicha con la pizarra abierta]** — el "Borrador 2", con lo que el docente dio en `rumbo` (o «lo que me contó de su salón» si no escribió nada):

> **Borrador 2 · Exploradores en Medellín con matemáticas**
> *Rumbo dado por [nombre]: «[cita, hasta 90 caracteres]»*
>
> 1. Cambiamos los trenes de Amtrak por algo que sus estudiantes sí reconocen —el **Metro**, una tienda del barrio, la cancha de la cuadra— y la fracción aparece en una situación que ya conocen.
> 2. Las distancias van en **cuadras y minutos**, no en millas, y los precios en **pesos**, no en dólares.
> 3. La tarea se resuelve con lo que tienen a la mano —sin internet obligatorio— y se comparte en clase, en voz alta.

`{{Vuelve a K7}}`
1. `{{Emote: K7_Saltito}}` ¡Por todos los circuitos! Mire nada más cómo se transformó esto. Con sus indicaciones, cambiamos los trenes por otra cosa. **Esto ya es otra cosa.**
2. Esta ya no es mi clase, profe. Es la suya. ¿La llevarías al salón?
3. `{{Emote: K7_Saltito}}` ¡!

**[Botón único]** — Profe, deme un momento antes de responderme. Quiero presentarle a alguien muy especial que ha estado observando nuestro trabajo: la **profe Vero**. Nos acompañará siempre al cierre de nuestras expediciones para ayudarnos a recoger los aprendizajes clave y hacerle entrega de su insignia de avance. ¡Buen día, profe Vero!
→ Botón: **«Hola, profe Vero»**

---

## 1.6 — Cierre con la profe Vero

*(Vero todavía no tiene modelo 3D: solo su diálogo, K-7 se queda quieto escuchando.)*

**[Respuesta dinámica]** — saludo de Vero, con el nombre del docente si ya lo dio (o «profe» si no):
«¡Hola, [nombre/"profe"]! Qué alegría saludarte. He seguido con mucha atención el trabajo que acabas de hacer con K-7.»

**Vero dice**, seguido:
1. Hay un punto fundamental que ustedes dos acaban de identificar: **la IA no distingue una buena clase de una que solo parece serlo.** ¡Pero un docente como tú sí!
2. Para que un maestro saque el verdadero provecho de la inteligencia artificial, necesita ofrecerle todo el contexto posible: quiénes son sus estudiantes, qué realidades viven, qué recursos tienen a mano, qué propósito formativo se busca, qué metodología quiere emplear, cómo quiere evaluar…

`{{Muestra imagen en tablero: Herramienta1.3.jpg}}`
**Vero dice**, todo esto con la misma pizarra abierta (`{{Sigue en el tablero}}` en cada línea después de la primera):
3. Puedes usar la IA de tu preferencia, pero algunas ya vienen configuradas para hacer el trabajo docente más sencillo.
4. `{{Sigue en el tablero}}` Así funciona la **IA Escuela Inteligente**: escuelainteligente.medellin.edu.co
5. `{{Sigue en el tablero}}` Incluso te hace las preguntas necesarias para cada caso, recurso o reflexión.
6. `{{Sigue en el tablero}}` ¿Y por qué usarla?
7. `{{Sigue en el tablero}}` Bueno, tienes ventajas, como ganar en agilidad mientras te ofrece una estructura bien soportada para cada tarea que le pidas.
8. `{{Sigue en el tablero}}` Y eso pasa sin que pierdas tu liderazgo en el proceso. Nunca lo puedes perder.
9. `{{Sigue en el tablero}}` Porque cada uno debe hacer lo que mejor sabe hacer: el docente piensa y conecta; la IA hace el trabajo de carpintería.

`{{Vuelve a K7}}` (al pasar a la siguiente pregunta)

**[Campo abierto: `reflexion`]** (lo pregunta Vero)
Profe, dime: **¿qué piensas sobre esta idea como conclusión de la primera expedición?**
Placeholder: *Tu reflexión de cierre…*

---

## 1.7 — Cierre e insignia

`{{Emote: K7_Triste, solo si dejó `reflexion` en blanco}}`
**[Respuesta dinámica, la dice K-7]** — según `reflexion`:
- **En blanco:** «Se quedó callado, profe. También eso lo archivo: hay cierres que se piensan más despacio de lo que yo calculo.»
- **Con respuesta:** «Muchas gracias, profe. ¡Sus palabras me llegan al algoritmo!»

**Vero dice**, seguido:
1. Ahora, para finalizar este nivel vamos a hacer dos cosas:
2. Primero, te voy a compartir una imagen con algunas ideas importantes y conclusiones sobre lo que conversaste con K-7:

`{{Muestra imagen en tablero: resumen1.4.png}}` (un clic la retira)
`{{Vuelve a K7}}`

3. Segundo, ha llegado el momento de entregarte tu merecido reconocimiento por haber completado la Primera Expedición:

`{{Muestra imagen en tablero: insignia1.png}}`
La frase que acompaña la insignia: «La IA no sabe quién eres tú»
`{{Vuelve a K7}}`

4. ¿Todo listo para la siguiente expedición? Seguiremos con *«La IA no sabe que puede hacer daño»*.

**[Botón único, lo dice Vero]** — Te dejo con K-7, para que te siga acompañando.
¡Nos vemos pronto!
→ Botón: **«Segunda Expedición»**

---

## Tabla de gestos usados (`{{Emote: ...}}`)

| Gesto | Dónde | Qué transmite |
|---|---|---|
| `K7_Pensando` | 1.2 (línea 3), 1.3 (línea 1) | K-7 cayendo en cuenta de algo |
| `K7_Saltito` (uno solo) | 1.5 (líneas 1 y 3) | Celebración/sorpresa puntual |
| `K7_Saltito` ×2 ladeado | 1.2 (línea 9, "profe, profe, profe…") | Dos saltitos seguidos, uno a la izquierda y otro idéntico a la derecha — es el único gesto compuesto, no está en la lista de emotes sueltos |
| `K7_HighFive` | 1.4 (línea 5) | Choque de manos, "trabajemos juntos" |
| `K7_Triste` (condicional) | 1.1 y 1.7, solo si el docente dejó el campo en blanco | K-7 se pone vulnerable ante el silencio |

Gestos disponibles que **todavía no se usan** en esta expedición: `K7_Caminando`. Si quieres uno en un punto nuevo, dímelo con `{{Emote: K7_X}}` en el sitio exacto.

## Preguntas abiertas de esta expedición

| Campo | En qué punto | Qué se le pregunta |
|---|---|---|
| `presentacion` | 1.1 | Su nombre y algo importante sobre sí mismo |
| `ajuste` | 1.2 | Qué le cambiaría al ejercicio de fracciones |
| `estudiantes` | 1.3 | Quiénes son sus estudiantes (sin datos personales) |
| `rumbo` | 1.4 | El rumbo/enfoque/contexto para reconstruir la actividad |
| `reflexion` | 1.6 | Su reflexión de cierre |

## Imágenes de esta expedición (ya en `docs/img/`)

| Archivo | Dónde aparece |
|---|---|
| `Actividad1.1.png` | 1.1 — el ejercicio original de trenes |
| `Actividad1.2.png` | 1.5 — el ejercicio reconstruido para Medellín |
| `Herramienta1.3.jpg` | 1.6 — captura de la IA Escuela Inteligente |
| `resumen1.4.png` | 1.7 — resumen de la expedición |
| `insignia1.png` | 1.7 — insignia de la Primera Expedición |

## Pendientes / notas

- Los textos con «kkkk» son el tic de K-7 cuando se pone nervioso — intencional.
- La imagen `Actividad1.1.png` dice "7° GRADO" pero el texto sigue diciendo "quinto grado" — sin resolver, avísame si cambio el texto o la imagen.
- El botón para bajar el mensaje y ver la pizarra completa no está marcado aquí porque no es parte del guion — vive siempre que hay una imagen en pantalla, sin que el guion lo dispare.
