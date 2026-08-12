/* =========================================================
   Barber King - citas.js
   Persona 3: agendar, listar y cancelar citas.
   Las citas se guardan en localStorage, asociadas al usuario
   con sesión activa (ver obtenerUsuarioActual() en auth.js).
   ========================================================= */

const CLAVE_CITAS = "barberking_citas";
const CLAVE_NOTIFICACIONES_ADMIN = "barberking_notificaciones_admin";
const CLAVE_NOTIFICACIONES_CLIENTE = "barberking_notificaciones_cliente";
const CLAVE_SOLICITUDES_REPROGRAMACION = "barberking_solicitudes_reprogramacion";

document.addEventListener("DOMContentLoaded", () => {
  const formAgendar = document.getElementById("form-agendar-cita");
  const listaCitas = document.getElementById("lista-citas");

  if (formAgendar) {
    formAgendar.addEventListener("submit", manejarAgendarCita);
    configurarRangoFecha();

    const selectServicio = document.getElementById("servicio");
    if (selectServicio) {
      selectServicio.addEventListener("change", actualizarBarberosDisponibles);
      actualizarBarberosDisponibles();
    }
  }

  if (listaCitas) {
    renderizarCitas();
    renderizarNotificacionesCliente();
  }
});

const NOMBRES_SERVICIO = {
  corte: "Corte de cabello",
  barba: "Arreglo de barba",
  combo: "Combo (corte + barba)",
  tinte: "Tinte / Coloración",
  rizado: "Tratamiento para Cabello Rizado",
  afro: "Tratamiento para Cabello Afro",
  ondulado: "Tratamiento para Pelo Ondulado",
  liso: "Tratamiento para Pelo Liso",
  combo_tinte: "Combo (Corte + Tinte/Coloración)",
  cejas: "Perfilado de Cejas",
  facial: "Tratamiento Facial Express",
  corte_mujer: "Corte de cabello mujer",
};

// Precios en colones (₡), informativos: el Sistema no procesa pagos reales.
const PRECIOS_SERVICIO = {
  corte: 6000,
  barba: 4000,
  combo: 9000,
  tinte: 12000,
  rizado: 9000,
  afro: 9000,
  ondulado: 9000,
  liso: 9000,
  combo_tinte: 14000,
  cejas: 2500,
  facial: 6500,
  corte_mujer: 6000,
};

const NOMBRES_BARBERO = {
  barbero1: "Alberto Martinez",
  barbero2: "Raul Gonzales",
  barbero3: "Daniel Rojas",
  barbero4: "Josué Vargas",
  barbero5: "Kevin Solano",
  barbero6: "Andrés Chacón",
  barbero7: "Luis Fernández",
  barbero8: "Ana Mora",
  barbero9: "Valeria Jiménez",
};

// Cada barbero está especializado en varios servicios. Se reparten para
// que cada servicio del catálogo tenga al menos 2 (y hasta 3) barberos
// que lo ofrezcan — así siempre hay opción para elegir.
const ESPECIALIDADES_BARBERO = {
  barbero1: ["combo", "corte", "barba"],
  barbero2: ["combo", "corte", "barba"],
  barbero3: ["combo", "corte", "barba"],
  barbero4: ["tinte", "combo_tinte", "cejas"],
  barbero5: ["cejas", "facial", "ondulado"],
  barbero6: ["rizado", "afro", "liso"],
  barbero7: ["ondulado", "liso", "rizado"],
  barbero8: ["corte_mujer", "tinte", "afro"],
  barbero9: ["corte_mujer", "facial", "combo_tinte"],
};

/**
 * Indica si un barbero está especializado en (puede agendar) un servicio.
 */
function barberoOfreceServicio(barbero, servicio) {
  const especialidades = ESPECIALIDADES_BARBERO[barbero];
  return Array.isArray(especialidades) && especialidades.includes(servicio);
}

/**
 * Al elegir un servicio en "Agendar Cita", oculta del selector de barbero
 * a quienes no estén especializados en ese servicio. Si el barbero ya
 * seleccionado deja de calificar, se limpia esa selección.
 */
function actualizarBarberosDisponibles() {
  const selectServicio = document.getElementById("servicio");
  const selectBarbero = document.getElementById("barbero");
  if (!selectServicio || !selectBarbero) return;

  const servicioElegido = selectServicio.value;
  const barberoPrevio = selectBarbero.value;

  Array.from(selectBarbero.options).forEach((opcion) => {
    if (!opcion.value) return; // deja siempre visible "Selecciona un barbero"

    const disponible = !servicioElegido || barberoOfreceServicio(opcion.value, servicioElegido);
    opcion.hidden = !disponible;
    opcion.disabled = !disponible;
  });

  if (servicioElegido && barberoPrevio && !barberoOfreceServicio(barberoPrevio, servicioElegido)) {
    selectBarbero.value = "";
  }
}

/**
 * Da formato de colones costarricenses a un monto, ej. formatearColones(6000) -> "₡6.000".
 */
function formatearColones(monto) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(monto);
}

/**
 * Obtiene todas las citas guardadas (de todos los usuarios) desde localStorage.
 */
function obtenerCitas() {
  const datos = localStorage.getItem(CLAVE_CITAS);
  return datos ? JSON.parse(datos) : [];
}

function guardarCitas(citas) {
  localStorage.setItem(CLAVE_CITAS, JSON.stringify(citas));
}

/**
 * Notificaciones para el administrador (ej. avisar que un cliente canceló
 * una cita). Como no hay servidor, se guardan en localStorage y se
 * muestran la próxima vez que el administrador entra a admin.html.
 */
function obtenerNotificacionesAdmin() {
  const datos = localStorage.getItem(CLAVE_NOTIFICACIONES_ADMIN);
  return datos ? JSON.parse(datos) : [];
}

function guardarNotificacionesAdmin(notificaciones) {
  localStorage.setItem(CLAVE_NOTIFICACIONES_ADMIN, JSON.stringify(notificaciones));
}

/**
 * Registra un aviso para el administrador indicando qué cita se canceló
 * y quién la canceló, ya que el administrador puede tener varias citas
 * el mismo día y necesita saber exactamente cuál se liberó.
 */
function notificarCancelacionAlAdmin(cita, motivo) {
  const notificaciones = obtenerNotificacionesAdmin();
  notificaciones.push({
    id: Date.now(),
    barbero: cita.barbero,
    mensaje: `${cita.usuario} canceló su cita de ${NOMBRES_SERVICIO[cita.servicio] || cita.servicio} con ${NOMBRES_BARBERO[cita.barbero] || cita.barbero}, agendada para el ${cita.fecha} a las ${formatearHora12(cita.hora)}. Motivo: ${motivo}`,
  });
  guardarNotificacionesAdmin(notificaciones);
}

/**
 * Solicitudes de reprogramación: cuando un cliente quiere cambiar la
 * fecha/hora de una cita, no se edita directamente — se guarda como una
 * solicitud pendiente hasta que el administrador la acepte o la rechace.
 */
function obtenerSolicitudesReprogramacion() {
  const datos = localStorage.getItem(CLAVE_SOLICITUDES_REPROGRAMACION);
  return datos ? JSON.parse(datos) : [];
}

function guardarSolicitudesReprogramacion(solicitudes) {
  localStorage.setItem(CLAVE_SOLICITUDES_REPROGRAMACION, JSON.stringify(solicitudes));
}

/**
 * Crea la solicitud de reprogramación y avisa al administrador.
 */
function crearSolicitudReprogramacion(cita, fechaNueva, horaNueva) {
  const solicitudes = obtenerSolicitudesReprogramacion();
  solicitudes.push({
    id: Date.now(),
    citaId: cita.id,
    usuario: cita.usuario,
    servicio: cita.servicio,
    barbero: cita.barbero,
    fechaActual: cita.fecha,
    horaActual: cita.hora,
    fechaNueva,
    horaNueva,
  });
  guardarSolicitudesReprogramacion(solicitudes);

  const notificaciones = obtenerNotificacionesAdmin();
  notificaciones.push({
    id: Date.now() + 1,
    barbero: cita.barbero,
    mensaje: `${cita.usuario} quiere reprogramar su cita de ${NOMBRES_SERVICIO[cita.servicio] || cita.servicio} con ${NOMBRES_BARBERO[cita.barbero] || cita.barbero}: del ${cita.fecha} a las ${formatearHora12(cita.hora)}, al ${fechaNueva} a las ${formatearHora12(horaNueva)}. Revísalo en "Solicitudes de Reprogramación".`,
  });
  guardarNotificacionesAdmin(notificaciones);
}

/**
 * Maneja el clic en "Reprogramar" de una cita: pide la nueva fecha y hora
 * por medio de dos cuadros de texto, los valida, y crea la solicitud.
 */
function solicitarReprogramacion(idCita) {
  const usuarioActual = obtenerUsuarioActual();
  const cita = obtenerCitas().find(
    (c) => c.id === idCita && c.usuario === usuarioActual
  );
  if (!cita) return;

  const yaTieneSolicitud = obtenerSolicitudesReprogramacion().some(
    (solicitud) => solicitud.citaId === idCita
  );
  if (yaTieneSolicitud) {
    window.alert("Ya enviaste una solicitud de reprogramación para esta cita. Espera la respuesta del administrador.");
    return;
  }

  const fechaNueva = window.prompt(
    `Nueva fecha para tu cita (formato AAAA-MM-DD).\nFecha actual: ${cita.fecha}`,
    cita.fecha
  );
  if (fechaNueva === null) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNueva) || !estaFechaEnRangoValido(fechaNueva)) {
    window.alert("Fecha inválida. Usa el formato AAAA-MM-DD y elige una fecha entre hoy y los próximos 12 meses.");
    return;
  }

  const horaNuevaTexto = window.prompt(
    'Nueva hora para tu cita (formato H:MM AM/PM, ejemplo "2:30 PM").',
    formatearHora12(cita.hora)
  );
  if (horaNuevaTexto === null) return;

  const horaNueva = convertirTexto12A24(horaNuevaTexto);
  if (!horaNueva) {
    window.alert('Hora inválida. Usa el formato H:MM AM/PM, por ejemplo "2:30 PM".');
    return;
  }

  if (!estaDentroDelHorarioDeAtencion(fechaNueva, horaNueva)) {
    window.alert(
      "Ese horario está fuera de nuestra atención: lunes a sábado de 10:00 a.m. a 7:00 p.m., domingos de 12:00 p.m. a 6:00 p.m."
    );
    return;
  }

  crearSolicitudReprogramacion(cita, fechaNueva, horaNueva);
  window.alert('Tu solicitud de reprogramación fue enviada. Te avisaremos en "Mis Citas" cuando el administrador la revise.');
  renderizarCitas();
}

/**
 * Notificaciones para el cliente (ej. avisar que el administrador canceló
 * una de sus citas). Cada aviso queda asociado al usuario dueño de la cita.
 */
function obtenerNotificacionesCliente() {
  const datos = localStorage.getItem(CLAVE_NOTIFICACIONES_CLIENTE);
  return datos ? JSON.parse(datos) : [];
}

function guardarNotificacionesCliente(notificaciones) {
  localStorage.setItem(CLAVE_NOTIFICACIONES_CLIENTE, JSON.stringify(notificaciones));
}

/**
 * Registra un aviso para el cliente dueño de la cita, indicando que el
 * administrador canceló esa cita en particular.
 */
function notificarCancelacionAlCliente(cita, motivo) {
  const notificaciones = obtenerNotificacionesCliente();
  notificaciones.push({
    id: Date.now(),
    usuario: cita.usuario,
    mensaje: `La barbería canceló tu cita de ${NOMBRES_SERVICIO[cita.servicio] || cita.servicio} con ${NOMBRES_BARBERO[cita.barbero] || cita.barbero}, agendada para el ${cita.fecha} a las ${formatearHora12(cita.hora)}. Motivo: ${motivo}`,
  });
  guardarNotificacionesCliente(notificaciones);
}

/**
 * Dibuja los avisos de citas canceladas por el administrador, dentro de
 * #notificaciones-cliente (mis-citas.html), filtrados por el usuario actual.
 */
function renderizarNotificacionesCliente() {
  const contenedor = document.getElementById("notificaciones-cliente");
  if (!contenedor) return;

  contenedor
    .querySelectorAll(".notificacion")
    .forEach((aviso) => aviso.remove());

  const usuarioActual = obtenerUsuarioActual();
  const notificaciones = obtenerNotificacionesCliente().filter(
    (notificacion) => notificacion.usuario === usuarioActual
  );

  if (notificaciones.length === 0) {
    contenedor.hidden = true;
    return;
  }

  contenedor.hidden = false;

  notificaciones.forEach((notificacion) => {
    const aviso = document.createElement("div");
    aviso.className = "notificacion";
    aviso.setAttribute("role", "status");

    const texto = document.createElement("span");
    texto.textContent = notificacion.mensaje;

    const botonDescartar = document.createElement("button");
    botonDescartar.type = "button";
    botonDescartar.textContent = "Descartar";
    botonDescartar.addEventListener("click", () => descartarNotificacionCliente(notificacion.id));

    aviso.appendChild(texto);
    aviso.appendChild(botonDescartar);
    contenedor.appendChild(aviso);
  });
}

/**
 * Elimina una notificación de cliente ya vista (botón "Descartar").
 */
function descartarNotificacionCliente(idNotificacion) {
  const notificaciones = obtenerNotificacionesCliente().filter(
    (notificacion) => notificacion.id !== idNotificacion
  );
  guardarNotificacionesCliente(notificaciones);
  renderizarNotificacionesCliente();
}

/**
 * Calcula el rango de fechas permitido para agendar/reprogramar: entre
 * hoy y los próximos 12 meses (evita años absurdos como 1900 o 9999).
 */
function obtenerRangoFechaPermitido() {
  const hoy = new Date();
  const fechaMaxima = new Date();
  fechaMaxima.setFullYear(hoy.getFullYear() + 1);

  return {
    min: formatearFechaISO(hoy),
    max: formatearFechaISO(fechaMaxima),
  };
}

/**
 * Limita el selector de fecha del formulario de "Agendar Cita" al rango
 * permitido.
 */
function configurarRangoFecha() {
  const inputFecha = document.getElementById("fecha");
  if (!inputFecha) return;

  const rango = obtenerRangoFechaPermitido();
  inputFecha.min = rango.min;
  inputFecha.max = rango.max;
}

function formatearFechaISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/**
 * Confirma que una fecha esté dentro del rango permitido (hoy a 12 meses).
 * Se usa tanto al agendar como al solicitar una reprogramación.
 */
function estaFechaEnRangoValido(fecha) {
  const rango = obtenerRangoFechaPermitido();
  return fecha >= rango.min && fecha <= rango.max;
}

/**
 * Convierte una hora en formato 12 horas (hora, minutos, AM/PM) al
 * formato 24 horas "HH:MM" que se usa internamente para guardar y comparar.
 */
function convertirHoraA24(horas12, minutos, periodo) {
  let horas = parseInt(horas12, 10) % 12;
  if (periodo === "PM") {
    horas += 12;
  }
  return `${String(horas).padStart(2, "0")}:${minutos}`;
}

/**
 * Convierte una hora en formato 24 horas "HH:MM" a un texto en formato
 * 12 horas con a. m./p. m., para mostrarla igual a como se eligió.
 */
function formatearHora12(hora24) {
  const [horasStr, minutos] = hora24.split(":");
  let horas = parseInt(horasStr, 10);
  const periodo = horas >= 12 ? "p. m." : "a. m.";
  horas = horas % 12;
  if (horas === 0) horas = 12;
  return `${horas}:${minutos} ${periodo}`;
}

/**
 * Convierte un texto tipo "2:30 PM" (el formato que se pide en el prompt
 * de reprogramación) al formato 24 horas "HH:MM". Devuelve null si el
 * texto no tiene un formato válido.
 */
function convertirTexto12A24(texto) {
  const coincidencia = String(texto)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!coincidencia) return null;

  const horas12 = parseInt(coincidencia[1], 10);
  const minutos = coincidencia[2];
  const periodo = coincidencia[3].toUpperCase();

  if (horas12 < 1 || horas12 > 12 || parseInt(minutos, 10) > 59) return null;

  return convertirHoraA24(String(horas12), minutos, periodo);
}

/**
 * Elimina cualquier solicitud de reprogramación pendiente asociada a una
 * cita (se usa al cancelar la cita, para no dejar solicitudes huérfanas).
 */
function eliminarSolicitudesDeCita(citaId) {
  const solicitudes = obtenerSolicitudesReprogramacion().filter(
    (solicitud) => solicitud.citaId !== citaId
  );
  guardarSolicitudesReprogramacion(solicitudes);
}

/**
 * Indica si ya existe otra cita para el mismo barbero, fecha y hora.
 * "idCitaAIgnorar" permite excluir la propia cita al reprogramar (para no
 * marcarla como "conflicto" contra sí misma).
 */
function existeConflictoDeHorario(barbero, fecha, hora, idCitaAIgnorar) {
  return obtenerCitas().some(
    (cita) =>
      cita.id !== idCitaAIgnorar &&
      cita.barbero === barbero &&
      cita.fecha === fecha &&
      cita.hora === hora
  );
}

/**
 * Verifica que una fecha/hora caiga dentro del horario de atención:
 * lunes a sábado 10:00 a. m. - 7:00 p. m., domingos 12:00 p. m. - 6:00 p. m.
 */
function estaDentroDelHorarioDeAtencion(fecha, hora) {
  // Se arma con hora local explícita para que el día de la semana no se
  // corra por el desfase de zona horaria (evitar "new Date('YYYY-MM-DD')").
  const diaSemana = new Date(`${fecha}T00:00:00`).getDay(); // 0 = domingo

  const [horas, minutos] = hora.split(":").map(Number);
  const minutosDelDia = horas * 60 + minutos;

  const esDomingo = diaSemana === 0;
  const horaApertura = esDomingo ? 12 * 60 : 10 * 60;
  const horaCierre = esDomingo ? 18 * 60 : 19 * 60;

  return minutosDelDia >= horaApertura && minutosDelDia <= horaCierre;
}

/**
 * Maneja el envío del formulario "Agendar Cita".
 */
function manejarAgendarCita(evento) {
  evento.preventDefault();

  const servicio = document.getElementById("servicio").value;
  const barbero = document.getElementById("barbero").value;
  const fecha = document.getElementById("fecha").value;
  const horaSeleccionada = document.getElementById("hora-horas").value;
  const minutosSeleccionados = document.getElementById("hora-minutos").value;
  const periodoSeleccionado = document.getElementById("hora-periodo").value;
  const mensaje = document.getElementById("mensaje-confirmacion-cita");

  if (
    !servicio ||
    !barbero ||
    !fecha ||
    !horaSeleccionada ||
    !minutosSeleccionados ||
    !periodoSeleccionado
  ) {
    mensaje.textContent = "Completa todos los campos antes de confirmar.";
    mensaje.classList.remove("mensaje-exito");
    mensaje.classList.add("mensaje-error");
    mensaje.hidden = false;
    return;
  }

  if (!barberoOfreceServicio(barbero, servicio)) {
    mensaje.textContent = `${NOMBRES_BARBERO[barbero] || barbero} no está especializado en "${NOMBRES_SERVICIO[servicio] || servicio}". Elige otro barbero o servicio.`;
    mensaje.classList.remove("mensaje-exito");
    mensaje.classList.add("mensaje-error");
    mensaje.hidden = false;
    return;
  }

  if (!estaFechaEnRangoValido(fecha)) {
    mensaje.textContent = "Elige una fecha entre hoy y los próximos 12 meses.";
    mensaje.classList.remove("mensaje-exito");
    mensaje.classList.add("mensaje-error");
    mensaje.hidden = false;
    return;
  }

  const hora = convertirHoraA24(horaSeleccionada, minutosSeleccionados, periodoSeleccionado);

  if (!estaDentroDelHorarioDeAtencion(fecha, hora)) {
    mensaje.textContent =
      "Ese horario está fuera de nuestra atención: lunes a sábado de 10:00 a.m. a 7:00 p.m., domingos de 12:00 p.m. a 6:00 p.m.";
    mensaje.classList.remove("mensaje-exito");
    mensaje.classList.add("mensaje-error");
    mensaje.hidden = false;
    return;
  }

  // Evita agendar dos citas para el mismo barbero, en la misma fecha y hora.
  if (existeConflictoDeHorario(barbero, fecha, hora, null)) {
    mensaje.textContent = `${NOMBRES_BARBERO[barbero] || barbero} ya tiene una cita agendada ese día a esa hora. Elige otra fecha, hora o barbero.`;
    mensaje.classList.remove("mensaje-exito");
    mensaje.classList.add("mensaje-error");
    mensaje.hidden = false;
    return;
  }

  const nuevaCita = {
    id: Date.now(),
    usuario: obtenerUsuarioActual(),
    servicio,
    barbero,
    fecha,
    hora,
    estado: "pendiente",
  };

  const citas = obtenerCitas();
  citas.push(nuevaCita);
  guardarCitas(citas);

  const precioCita = PRECIOS_SERVICIO[servicio];
  mensaje.textContent = `¡Cita agendada con éxito! Total: ${formatearColones(precioCita)}. Puedes revisarla en "Mis Citas".`;
  mensaje.classList.remove("mensaje-error");
  mensaje.classList.add("mensaje-exito");
  mensaje.hidden = false;
  evento.target.reset();
}

/**
 * Dibuja en pantalla las citas del usuario con sesión activa,
 * dentro de #lista-citas (mis-citas.html).
 */
function renderizarCitas() {
  const contenedor = document.getElementById("lista-citas");
  const mensajeSinCitas = document.getElementById("mensaje-sin-citas");
  const usuarioActual = obtenerUsuarioActual();

  contenedor
    .querySelectorAll(".tarjeta-cita")
    .forEach((tarjeta) => tarjeta.remove());

  const citasDelUsuario = obtenerCitas().filter(
    (cita) => cita.usuario === usuarioActual
  );

  if (citasDelUsuario.length === 0) {
    mensajeSinCitas.hidden = false;
    return;
  }

  mensajeSinCitas.hidden = true;

  const solicitudesPendientes = obtenerSolicitudesReprogramacion();

  citasDelUsuario.forEach((cita) => {
    // Se arma la tarjeta con createElement/textContent (en vez de innerHTML)
    // para que el contenido de la cita nunca se interprete como HTML/JS.
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-cita";

    const detalle = document.createElement("div");

    const nombreServicio = document.createElement("strong");
    nombreServicio.textContent = NOMBRES_SERVICIO[cita.servicio] || cita.servicio;

    const infoCita = document.createElement("p");
    const precioServicio = PRECIOS_SERVICIO[cita.servicio];
    infoCita.textContent = `${NOMBRES_BARBERO[cita.barbero] || cita.barbero} · ${cita.fecha} · ${formatearHora12(cita.hora)} · ${precioServicio !== undefined ? formatearColones(precioServicio) : ""}`;

    const estadoCita = document.createElement("span");
    const esCompletada = cita.estado === "completada";
    estadoCita.className = esCompletada ? "estado-badge estado-completada" : "estado-badge estado-pendiente";
    estadoCita.textContent = esCompletada ? "Completada" : "Pendiente";

    detalle.appendChild(nombreServicio);
    detalle.appendChild(infoCita);
    detalle.appendChild(estadoCita);

    const tieneSolicitudPendiente = solicitudesPendientes.some(
      (solicitud) => solicitud.citaId === cita.id
    );

    if (tieneSolicitudPendiente) {
      const avisoSolicitud = document.createElement("p");
      avisoSolicitud.className = "aviso-solicitud-pendiente";
      avisoSolicitud.textContent = "Reprogramación solicitada, esperando respuesta del administrador.";
      detalle.appendChild(avisoSolicitud);
    }

    const acciones = document.createElement("div");
    acciones.className = "acciones-cita";

    if (!esCompletada && !tieneSolicitudPendiente) {
      const botonReprogramar = document.createElement("button");
      botonReprogramar.type = "button";
      botonReprogramar.textContent = "Reprogramar";
      botonReprogramar.addEventListener("click", () => solicitarReprogramacion(cita.id));
      acciones.appendChild(botonReprogramar);
    }

    const botonCancelar = document.createElement("button");
    botonCancelar.type = "button";
    botonCancelar.textContent = "Cancelar Cita";
    botonCancelar.addEventListener("click", () => cancelarCita(cita.id));
    acciones.appendChild(botonCancelar);

    tarjeta.appendChild(detalle);
    tarjeta.appendChild(acciones);
    contenedor.appendChild(tarjeta);
  });
}

/**
 * Cancela (elimina) una cita por su id y vuelve a dibujar la lista.
 */
function cancelarCita(idCita) {
  const confirmarCancelacion = window.confirm(
    "¿Seguro que deseas cancelar esta cita?"
  );
  if (!confirmarCancelacion) return;

  // Este paso es solo para el motivo: la cita ya se va a cancelar sin
  // importar qué botón se presione aquí (evita confundir el "Cancelar"
  // del cuadro con "no cancelar la cita", que ya se confirmó arriba).
  const motivoIngresado = window.prompt(
    "¿Cuál es el motivo de la cancelación? (opcional)"
  );
  const motivoFinal = (motivoIngresado || "").trim() || "Sin motivo especificado";

  const usuarioActual = obtenerUsuarioActual();
  const citas = obtenerCitas();

  // Solo se identifica/elimina la cita si además de coincidir el id,
  // pertenece al usuario con sesión activa (evita cancelar citas de otra persona).
  const citaCancelada = citas.find(
    (cita) => cita.id === idCita && cita.usuario === usuarioActual
  );
  if (!citaCancelada) return;

  const citasRestantes = citas.filter((cita) => cita.id !== idCita);
  guardarCitas(citasRestantes);
  eliminarSolicitudesDeCita(idCita);

  notificarCancelacionAlAdmin(citaCancelada, motivoFinal);
  renderizarCitas();
}
