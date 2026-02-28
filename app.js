// Importamos Supabase directamente desde internet (sin instalar nada)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://bbnagkmbduzskievwraw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJibmFna21iZHV6c2tpZXZ3cmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTkzNTYsImV4cCI6MjA4Nzc5NTM1Nn0.rCPFXzE1hpRtMOBe7OUa1wBHUD6PQseUFyFmo8s9EP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables globales para guardar el estado
let personajeActivoId = null;

// Referencias a los elementos del HTML
const ventanaChat = document.getElementById('ventana-chat');
const inputMensaje = document.getElementById('input-mensaje');
const formulario = document.getElementById('formulario-chat');
const btnEnviar = document.getElementById('btn-enviar');
const nombreCabecera = document.getElementById('nombre-personaje-activo');
const listaPersonajes = document.getElementById('lista-personajes');

// --- 1. DIBUJAR BURBUJAS DE CHAT ---
function inyectarMensaje(rol, contenido) {
    const divBurbuja = document.createElement('div');
    divBurbuja.classList.add('max-w-[85%]', 'md:max-w-[75%]', 'p-4', 'rounded-2xl', 'text-sm', 'sm:text-base', 'break-words', 'leading-relaxed', 'shadow-sm', 'w-fit');
    
    // Contenedor extra para alinear a la izquierda o derecha
    const fila = document.createElement('div');
    fila.classList.add('flex', 'w-full');

    if (rol === 'user') {
        fila.classList.add('justify-end'); // Tu mensaje va a la derecha
        divBurbuja.classList.add('bg-blue-600', 'text-white', 'rounded-br-sm');
    } else {
        fila.classList.add('justify-start'); // El mensaje de la IA va a la izquierda
        divBurbuja.classList.add('bg-gray-800', 'text-gray-100', 'border', 'border-gray-700', 'rounded-bl-sm');
    }
    
    divBurbuja.textContent = contenido;
    fila.appendChild(divBurbuja);
    ventanaChat.appendChild(fila);
    ventanaChat.scrollTop = ventanaChat.scrollHeight; // Auto-scroll hacia abajo
}

// --- 2. CARGAR PERSONAJES DESDE SUPABASE ---
async function cargarPersonajes() {
    const { data: personajes, error } = await supabase.from('personajes').select('*');
    listaPersonajes.innerHTML = ''; // Limpiamos el texto de "Cargando..."

    if (error || !personajes || personajes.length === 0) {
        listaPersonajes.innerHTML = '<p class="text-gray-500 text-sm p-2 text-center">No hay personajes todavía.</p>';
        return;
    }

    personajes.forEach(pj => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left p-3 hover:bg-gray-800 rounded-xl transition-colors text-white font-medium border border-transparent hover:border-gray-700 mb-1';
        btn.textContent = pj.nombre;
        // Al hacer clic, abrimos el chat de este personaje
        btn.onclick = () => seleccionarPersonaje(pj.id, pj.nombre);
        listaPersonajes.appendChild(btn);
    });
}

// --- 3. SELECCIONAR PERSONAJE Y CARGAR HISTORIAL ---
async function seleccionarPersonaje(id, nombre) {
    personajeActivoId = id;
    nombreCabecera.textContent = nombre;
    ventanaChat.innerHTML = ''; // Limpiamos la pantalla
    
    // Desbloqueamos el input para que puedas escribir
    inputMensaje.disabled = false;
    btnEnviar.disabled = false;
    inputMensaje.placeholder = `Hablando con ${nombre}...`;
    inputMensaje.focus();

    // Buscamos si ya tenían mensajes viejos en la base de datos
    const { data: historial } = await supabase
        .from('mensajes')
        .select('*')
        .eq('personaje_id', id)
        .order('creado_en', { ascending: true }); // Del más viejo al más nuevo

    if (historial && historial.length > 0) {
        historial.forEach(msg => inyectarMensaje(msg.rol, msg.contenido));
    } else {
        // Mensaje estético si el chat está vacío
        const msjVacio = document.createElement('p');
        msjVacio.className = 'text-center text-gray-500 text-sm mt-4 msj-vacio';
        msjVacio.textContent = 'Aún no hay mensajes. ¡Inicia la conversación!';
        ventanaChat.appendChild(msjVacio);
    }
}

// --- 4. ENVIAR MENSAJE ---
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textoUsuario = inputMensaje.value.trim();
    if (!textoUsuario || !personajeActivoId) return;

    // Quitamos el mensaje de "vacío" si es el primer mensaje
    const msjVacioInfo = ventanaChat.querySelector('.msj-vacio');
    if (msjVacioInfo) msjVacioInfo.remove();

    // Bloqueamos el input mientras la IA "piensa"
    inputMensaje.value = '';
    inputMensaje.disabled = true;
    btnEnviar.disabled = true;
    inputMensaje.placeholder = 'La IA está escribiendo...';

    // Mostramos el mensaje del usuario en pantalla
    inyectarMensaje('user', textoUsuario);

    try {
        // A. Guardamos el mensaje del usuario en Supabase
        await supabase.from('mensajes').insert([
            { personaje_id: personajeActivoId, rol: 'user', contenido: textoUsuario }
        ]);

        // B. Le pedimos a Supabase el historial para darle memoria a la IA
        const { data: historial } = await supabase
            .from('mensajes')
            .select('rol, contenido')
            .eq('personaje_id', personajeActivoId)
            .order('creado_en', { ascending: true });

        // Formateamos el historial para OpenRouter
        const mensajesParaIA = historial.map(msg => ({
            role: msg.rol === 'user' ? 'user' : 'assistant',
            content: msg.contenido
        }));

        // C. Enviamos todo a nuestro archivo secreto en Vercel
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensajes: mensajesParaIA })
        });

        if (!response.ok) throw new Error('Error al conectar con el servidor proxy de Vercel');

        const datosIA = await response.json();
        const textoIA = datosIA.choices[0].message.content;

        // D. Mostramos la respuesta en pantalla
        inyectarMensaje('assistant', textoIA);

        // E. Guardamos la respuesta de la IA en Supabase
        await supabase.from('mensajes').insert([
            { personaje_id: personajeActivoId, rol: 'assistant', contenido: textoIA }
        ]);

    } catch (error) {
        console.error(error);
        inyectarMensaje('assistant', "❌ Error de conexión. Revisa la consola.");
    } finally {
        // Desbloqueamos el input
        inputMensaje.disabled = false;
        btnEnviar.disabled = false;
        inputMensaje.placeholder = `Escribe tu mensaje aquí...`;
        inputMensaje.focus();
    }
});

// Inicialización: Cargamos los personajes al entrar a la página
cargarPersonajes();
