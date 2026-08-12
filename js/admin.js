/* =========================================================
   Barber King - admin.js
   Panel de administrador (los 7 barberos del equipo): login separado
   del de clientes. Cada administrador ve y gestiona ÚNICAMENTE las
   citas agendadas con SU barbero asociado (campo "barbero" en su
   cuenta). Reutiliza obtenerUsuarios/guardarUsuarios/generarSal/
   hashearContrasena de auth.js, y obtenerCitas/guardarCitas/
   NOMBRES_* de citas.js.
   ========================================================= */

const CLAVE_SESION_ADMIN = "barberking_sesion_admin";

// Cuentas de administrador que se crean automáticamente la primera vez
// que se abre admin-login.html, si todavía no existen en localStorage.
// "barberoAsociado" vincula la cuenta con una clave de NOMBRES_BARBERO
// (js/citas.js), para que cada administrador solo vea sus propias citas.
const CUENTAS_ADMIN_INICIALES = [
  { usuario: "alberto.martinez", nombre: "Alberto Martinez", contrasenaInicial: "Barbero2026!", barberoAsociado: "barbero1" },
  { usuario: "raul.gonzalez", nombre: "Raul Gonzales", contrasenaInicial: "Barbero2026#", barberoAsociado: "barbero2" },
  { usuario: "daniel.rojas", nombre: "Daniel Rojas", contrasenaInicial: "Barbero2026$", barberoAsociado: "barbero3" },
  { usuario: "josue.vargas", nombre: "Josué Vargas", contrasenaInicial: "Barbero2026%", barberoAsociado: "barbero4" },
  { usuario: "kevin.solano", nombre: "Kevin Solano", contrasenaInicial: "Barbero2026&", barberoAsociado: "barbero5" },
  { usuario: "andres.chacon", nombre: "Andrés Chacón", contrasenaInicial: "Barbero2026*", barberoAsociado: "barbero6" },
  { usuario: "luis.fernandez", nombre: "Luis Fernández", contrasenaInicial: "Barbero2026+", barberoAsociado: "barbero7" },
  { usuario: "ana.mora", nombre: "Ana Mora", contrasenaInicial: "Barbero2026=", barberoAsociado: "barbero8" },
  { usuario: "valeria.jimenez", nombre: "Valeria Jiménez", contrasenaInicial: "Barbero2026?", barberoAsociado: "barbero9" },
];

document.addEventListener("DOMContentLoaded", async () => {
  await sembrarAdminSiNoExiste();

  const formAdminLogin = document.getElementById("form-admin-login");
  const btnCerrarSesionAdmin = document.getElementById("btn-cerrar-sesion-admin");
  const listaAdminCitas = document.getElementById("lista-admin-citas");
  const bienvenidaAdmin = document.getElementById("bienvenida-admin");

  if (formAdminLogin) {
    formAdminLogin.addEventListener("submit", manejarAdminLogin);
  }

  if (btnCerrarSesionAdmin) {
    btnCerrarSesionAdmin.addEventListener("click", cerrarSesionAdmin);
  }

  if (listaAdminCitas) {
    protegerPaginaAdmin();

    if (bienvenidaAdmin) {
      bienvenidaAdmin.textContent = `Panel de Administrador · ${nombreDelAdminActual()}`;
    }

    renderizarCitasAdmin();
    renderizarNotificacionesAdmin();
    renderizarSolicitudesReprogramacion();
  }
});

/**
 * Crea las cuentas de administrador iniciales (rol "administrador") la
 * primera vez que se abre admin-login.html, si todavía no existen.
 */
async function sembrarAdminSiNoExiste() {
  const usuarios = obtenerUsuarios();
  let seModificaron = false;

  for (const cuenta of CUENTAS_ADMIN_INICIALES) {
    const existente = usuarios.find((u) => u.usuario === cuenta.usuario);

    if (existente) {
      // Cuenta creada en una versión anterior (antes de vincular cada
      // administrador a un barbero): se completa el campo que falte.
      if (!existente.barbero) {
        existente.barbero = cuenta.barberoAsociado;
        seModificaron = true;
      }
      continue;
    }

    const sal = generarSal();
    const hash = await hashearContrasena(cuenta.contrasenaInicial, sal);

    usuarios.push({
      nombre: cuenta.nombre,
      usuario: cuenta.usuario,
      sal,
      hash,
      rol: "administrador",
      barbero: cuenta.barberoAsociado,
    });
    seModificaron = true;
  }

  if (seModificaron) {
    guardarUsuarios(usuarios);
  }
}

/**
 * Devuelve la cuenta (objeto usuario) del administrador con sesión activa.
 */
function adminActual() {
  const usuarioActual = localStorage.getItem(CLAVE_SESION_ADMIN);
  return obtenerUsuarios().find((u) => u.usuario === usuarioActual) || null;
}

/**
 * Devuelve el nombre completo del administrador con sesión activa
 * (para mostrarlo en el encabezado de admin.html).
 */
function nombreDelAdminActual() {
  const admin = adminActual();
  return admin ? admin.nombre : "Administrador";
}

/**
 * Devuelve la clave de barbero (ej. "barbero1") asociada al administrador
 * con sesión activa — determina qué citas puede ver y gestionar.
 */
function barberoDelAdminActual() {
  const admin = adminActual();
  return admin ? admin.barbero : null;
}

/**
 * Maneja el login exclusivo de administrador (admin-login.html).
 */
async function manejarAdminLogin(evento) {
  evento.preventDefault();

  const usuario = document.getElementById("usuario").value.trim();
  const contrasena = document.getElementById("contrasena").value;
  const mensajeError = document.getElementById("mensaje-error-admin-login");

  const usuarioEncontrado = obtenerUsuarios().find(
    (u) => u.usuario.toLowerCase() === usuario.toLowerCase()
  );

  if (!usuarioEncontrado || usuarioEncontrado.rol !== "administrador") {
    mostrarMensaje(mensajeError, "Usuario o contraseña incorrectos.");
    return;
  }

  const hashIngresado = await hashearContrasena(contrasena, usuarioEncontrado.sal);

  if (hashIngresado !== usuarioEncontrado.hash) {
    mostrarMensaje(mensajeError, "Usuario o contraseña incorrectos.");
    return;
  }

  localStorage.setItem(CLAVE_SESION_ADMIN, usuarioEncontrado.usuario);
  window.location.href = "admin.html";
}

/**
 * Redirige a admin-login.html si no hay sesión de administrador activa.
 */
function protegerPaginaAdmin() {
  if (!localStorage.getItem(CLAVE_SESION_ADMIN)) {
    window.location.href = "admin-login.html";
  }
}

/**
 * Cierra la sesión de administrador y redirige a su login.
 */
function cerrarSesionAdmin() {
  localStorage.removeItem(CLAVE_SESION_ADMIN);
  window.location.href = "admin-login.html";
}

/**
 * Dibuja en pantalla las citas del barbero asociado al administrador con
 * sesión activa (no las de todos los barberos), dentro de
 * #lista-admin-citas (admin.html), con acciones de completar/cancelar.
 */
function renderizarCitasAdmin() {
  const contenedor = document.getElementById("lista-admin-citas");
  const mensajeSinCitas = document.getElementById("mensaje-sin-citas-admin");

  contenedor
    .querySelectorAll(".tarjeta-cita")
    .forEach((tarjeta) => tarjeta.remove());

  const barberoActual = barberoDelAdminActual();
  const citas = obtenerCitas().filter((cita) => cita.barbero === barberoActual);

  if (citas.length === 0) {
    mensajeSinCitas.hidden = false;
    return;
  }

  mensajeSinCitas.hidden = true;

  citas.forEach((cita) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-cita";

    const detalle = document.createElement("div");

    const nombreServicio = document.createElement("strong");
    nombreServicio.textContent = NOMBRES_SERVICIO[cita.servicio] || cita.servicio;

    const infoCita = document.createElement("p");
    const precioServicio = PRECIOS_SERVICIO[cita.servicio];
    infoCita.textContent = `${NOMBRES_BARBERO[cita.barbero] || cita.barbero} · ${cita.fecha} · ${formatearHora12(cita.hora)} · ${precioServicio !== undefined ? formatearColones(precioServicio) : ""}`;

    const infoCliente = document.createElement("p");
    infoCliente.textContent = `Cliente: ${cita.usuario}`;

    const esCompletada = cita.estado === "completada";
    const estadoCita = document.createElement("span");
    estadoCita.className = esCompletada ? "estado-badge estado-completada" : "estado-badge estado-pendiente";
    estadoCita.textContent = esCompletada ? "Completada" : "Pendiente";

    detalle.appendChild(nombreServicio);
    detalle.appendChild(infoCita);
    detalle.appendChild(infoCliente);
    detalle.appendChild(estadoCita);

    const acciones = document.createElement("div");
    acciones.className = "acciones-cita";

    if (!esCompletada) {
      const botonCompletar = document.createElement("button");
      botonCompletar.type = "button";
      botonCompletar.textContent = "Marcar como completada";
      botonCompletar.addEventListener("click", () => marcarCitaCompletada(cita.id));
      acciones.appendChild(botonCompletar);
    }

    const botonCancelar = document.createElement("button");
    botonCancelar.type = "button";
    botonCancelar.textContent = "Cancelar Cita";
    botonCancelar.addEventListener("click", () => cancelarCitaAdmin(cita.id));
    acciones.appendChild(botonCancelar);

    tarjeta.appendChild(detalle);
    tarjeta.appendChild(acciones);
    contenedor.appendChild(tarjeta);
  });
}

/**
 * Marca una cita como "completada" (sin restricción de dueño: el admin
 * puede completar la cita de cualquier cliente).
 */
function marcarCitaCompletada(idCita) {
  const citas = obtenerCitas().map((cita) =>
    cita.id === idCita ? { ...cita, estado: "completada" } : cita
  );
  guardarCitas(citas);
  renderizarCitasAdmin();
}

/**
 * Cancela (elimina) cualquier cita por su id, sin restricción de dueño.
 */
function cancelarCitaAdmin(idCita) {
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

  const citas = obtenerCitas();
  const citaCancelada = citas.find((cita) => cita.id === idCita);
  if (!citaCancelada) return;

  const citasRestantes = citas.filter((cita) => cita.id !== idCita);
  guardarCitas(citasRestantes);
  eliminarSolicitudesDeCita(idCita);

  notificarCancelacionAlCliente(citaCancelada, motivoFinal);
  renderizarCitasAdmin();
  renderizarSolicitudesReprogramacion();
}

/**
 * Dibuja los avisos de citas canceladas por clientes (guardados en
 * localStorage por notificarCancelacionAlAdmin(), en citas.js),
 * filtrados al barbero del administrador con sesión activa.
 */
function renderizarNotificacionesAdmin() {
  const contenedor = document.getElementById("notificaciones-admin");
  if (!contenedor) return;

  contenedor
    .querySelectorAll(".notificacion")
    .forEach((aviso) => aviso.remove());

  const barberoActual = barberoDelAdminActual();
  const notificaciones = obtenerNotificacionesAdmin().filter(
    (notificacion) => notificacion.barbero === barberoActual
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
    botonDescartar.addEventListener("click", () => descartarNotificacionAdmin(notificacion.id));

    aviso.appendChild(texto);
    aviso.appendChild(botonDescartar);
    contenedor.appendChild(aviso);
  });
}

/**
 * Elimina una notificación ya vista (botón "Descartar").
 */
function descartarNotificacionAdmin(idNotificacion) {
  const notificaciones = obtenerNotificacionesAdmin().filter(
    (notificacion) => notificacion.id !== idNotificacion
  );
  guardarNotificacionesAdmin(notificaciones);
  renderizarNotificacionesAdmin();
}

/**
 * Dibuja las solicitudes de reprogramación pendientes para el barbero del
 * administrador con sesión activa, dentro de
 * #lista-solicitudes-reprogramacion (admin.html), con botones para
 * aceptarlas o rechazarlas.
 */
function renderizarSolicitudesReprogramacion() {
  const contenedor = document.getElementById("lista-solicitudes-reprogramacion");
  const mensajeSinSolicitudes = document.getElementById("mensaje-sin-solicitudes");
  if (!contenedor) return;

  contenedor
    .querySelectorAll(".tarjeta-cita")
    .forEach((tarjeta) => tarjeta.remove());

  const barberoActual = barberoDelAdminActual();
  const solicitudes = obtenerSolicitudesReprogramacion().filter(
    (solicitud) => solicitud.barbero === barberoActual
  );

  if (solicitudes.length === 0) {
    mensajeSinSolicitudes.hidden = false;
    return;
  }

  mensajeSinSolicitudes.hidden = true;

  solicitudes.forEach((solicitud) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-cita";

    const detalle = document.createElement("div");

    const titulo = document.createElement("strong");
    titulo.textContent = `${solicitud.usuario} · ${NOMBRES_SERVICIO[solicitud.servicio] || solicitud.servicio} con ${NOMBRES_BARBERO[solicitud.barbero] || solicitud.barbero}`;

    const cambio = document.createElement("p");
    cambio.textContent = `De: ${solicitud.fechaActual} ${formatearHora12(solicitud.horaActual)}  →  A: ${solicitud.fechaNueva} ${formatearHora12(solicitud.horaNueva)}`;

    detalle.appendChild(titulo);
    detalle.appendChild(cambio);

    const acciones = document.createElement("div");
    acciones.className = "acciones-cita";

    const botonAceptar = document.createElement("button");
    botonAceptar.type = "button";
    botonAceptar.textContent = "Aceptar";
    botonAceptar.addEventListener("click", () => aceptarSolicitudReprogramacion(solicitud.id));

    const botonRechazar = document.createElement("button");
    botonRechazar.type = "button";
    botonRechazar.textContent = "Rechazar";
    botonRechazar.addEventListener("click", () => rechazarSolicitudReprogramacion(solicitud.id));

    acciones.appendChild(botonAceptar);
    acciones.appendChild(botonRechazar);

    tarjeta.appendChild(detalle);
    tarjeta.appendChild(acciones);
    contenedor.appendChild(tarjeta);
  });
}

/**
 * Acepta una solicitud: mueve la cita a la nueva fecha/hora (si sigue
 * libre) y avisa al cliente.
 */
function aceptarSolicitudReprogramacion(idSolicitud) {
  const solicitudes = obtenerSolicitudesReprogramacion();
  const solicitud = solicitudes.find((s) => s.id === idSolicitud);
  if (!solicitud) return;

  if (
    existeConflictoDeHorario(
      solicitud.barbero,
      solicitud.fechaNueva,
      solicitud.horaNueva,
      solicitud.citaId
    )
  ) {
    window.alert(
      `${NOMBRES_BARBERO[solicitud.barbero] || solicitud.barbero} ya tiene otra cita en ese horario nuevo. Rechaza esta solicitud o coordina otro horario con el cliente.`
    );
    return;
  }

  const citas = obtenerCitas().map((cita) =>
    cita.id === solicitud.citaId
      ? { ...cita, fecha: solicitud.fechaNueva, hora: solicitud.horaNueva }
      : cita
  );
  guardarCitas(citas);

  const solicitudesRestantes = solicitudes.filter((s) => s.id !== idSolicitud);
  guardarSolicitudesReprogramacion(solicitudesRestantes);

  const notificacionesCliente = obtenerNotificacionesCliente();
  notificacionesCliente.push({
    id: Date.now(),
    usuario: solicitud.usuario,
    mensaje: `Tu solicitud para reprogramar la cita de ${NOMBRES_SERVICIO[solicitud.servicio] || solicitud.servicio} con ${NOMBRES_BARBERO[solicitud.barbero] || solicitud.barbero} fue ACEPTADA. Nueva fecha: ${solicitud.fechaNueva} a las ${formatearHora12(solicitud.horaNueva)}.`,
  });
  guardarNotificacionesCliente(notificacionesCliente);

  renderizarSolicitudesReprogramacion();
  renderizarCitasAdmin();
}

/**
 * Rechaza una solicitud de reprogramación (la cita se mantiene igual) y
 * avisa al cliente, con un motivo opcional.
 */
function rechazarSolicitudReprogramacion(idSolicitud) {
  const solicitudes = obtenerSolicitudesReprogramacion();
  const solicitud = solicitudes.find((s) => s.id === idSolicitud);
  if (!solicitud) return;

  const motivoIngresado = window.prompt("Motivo del rechazo (opcional):");
  const motivoFinal = (motivoIngresado || "").trim();

  const solicitudesRestantes = solicitudes.filter((s) => s.id !== idSolicitud);
  guardarSolicitudesReprogramacion(solicitudesRestantes);

  const notificacionesCliente = obtenerNotificacionesCliente();
  notificacionesCliente.push({
    id: Date.now(),
    usuario: solicitud.usuario,
    mensaje: `Tu solicitud para reprogramar la cita de ${NOMBRES_SERVICIO[solicitud.servicio] || solicitud.servicio} con ${NOMBRES_BARBERO[solicitud.barbero] || solicitud.barbero} fue RECHAZADA. Tu cita se mantiene para el ${solicitud.fechaActual} a las ${formatearHora12(solicitud.horaActual)}.${motivoFinal ? ` Motivo: ${motivoFinal}` : ""}`,
  });
  guardarNotificacionesCliente(notificacionesCliente);

  renderizarSolicitudesReprogramacion();
}
