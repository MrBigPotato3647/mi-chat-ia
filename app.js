import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- CONFIGURACIÓN DE SUPABASE (Corregida, sin duplicados) ---
const SUPABASE_URL = 'https://bbnagkmbduzskievwraw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJibmFna21iZHV6c2tpZXZ3cmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTkzNTYsImV4cCI6MjA4Nzc5NTM1Nn0.rCPFXzE1hpRtMOBe7OUa1wBHUD6PQseUFyFmo8s9EP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ESTADO GLOBAL ---
let personajeActivoId = null;
let personajeActivoPrompt = ""; 

// --- REFERENCIAS DEL DOM (HTML) ---
const ventanaChat = document.getElementById('ventana-chat');
const inputMensaje = document.getElementById('input-mensaje');
const formularioChat = document.getElementById('formulario-chat');
const btnEnviar = document.getElementById('btn-enviar');
const nombreCabecera = document.getElementById('nombre-personaje-activo');
const listaPersonajes = document.getElementById('lista-personajes');

const modalCrear = document.getElementById('modal-crear');
const btnNuevoPersonaje = document.getElementById('btn-nuevo-personaje');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const formularioCrear = document.getElementById('formulario-crear');

// --- 1. DIBUJAR BURBUJAS DE CHAT ---
function inyectarMensaje(rol, contenido) {
    const divBurbuja = document.createElement('div');
    divBurbuja.classList.add('max-w-[85%]', 'md:max-w-[75%]', 'p-4', 'rounded-2xl', 'text-sm', 'sm:text-base', 'break-words', 'leading-relaxed', 'shadow-sm', 'w-fit');
    
    const fila = document.createElement('div');
    fila.classList.add('flex', 'w-full');

    if (rol === 'user') {
        fila.classList.add('justify-end'); 
        divBurbuja.classList.add('bg-blue-600', 'text-white', 'rounded-br-sm');
    } else {
        fila.classList.add('justify-start'); 
        divBurbuja.classList.add('bg-gray-800', 'text-gray-100', 'border', 'border-gray-700', 'rounded-bl-sm');
    }
    
    divBurbuja.textContent = contenido;
    fila.appendChild(divBurbuja);
    ventanaChat.appendChild(fila);
    ventanaChat.scrollTop = ventanaChat.scrollHeight; 
}

// --- 2. CARGAR PERSONAJES DESDE SUPABASE ---
async function cargarPersonajes() {
    const { data: personajes, error } = await supabase.from('personajes').select('*');
    listaPersonajes.innerHTML = ''; 

    if (error || !personajes || personajes.length === 0) {
        listaPersonajes.innerHTML = '<p class="text-gray-500 text-sm p-2 text-center">No hay personajes todavía.</p>';
        return;
    }

    personajes.forEach(pj => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left p-3 hover:bg-gray-800 rounded-xl transition-colors text-white font-medium border border-transparent hover:border-gray-700 mb-1';
        btn.textContent = pj.nombre;
        btn.onclick = () => seleccionarPersonaje(pj.id, pj.nombre, pj.prompt_sistema);
        listaPersonajes.appendChild(btn);
    });
}

// --- 3. SELECCIONAR PERSONAJE Y CARGAR HISTORIAL ---
async function seleccionarPersonaje(id, nombre, promptSistema) {
    personajeActivoId = id;
    personajeActivoPrompt = promptSistema; 
    nombreCabecera.textContent = nombre;
    ventanaChat.innerHTML = ''; 
    
    inputMensaje.disabled = false;
    btnEnviar.disabled = false;
    inputMensaje.placeholder = `Hablando con ${nombre}...`;
    inputMensaje.focus();

    const { data: historial } = await supabase
        .from('mensajes')
        .select('*')
        .eq('personaje_id', id)
        .order('creado_en', { ascending: true }); 

    if (historial && historial.length > 0) {
        historial.forEach(msg => inyectarMensaje(msg.rol, msg.contenido));
    } else {
        const msjVacio = document.createElement('p');
        msjVacio.className = 'text-center text-gray-500 text-sm mt-4 msj-vacio';
        msjVacio.textContent = 'Aún no hay mensajes. ¡Inicia la conversación!';
        ventanaChat.appendChild(msjVacio);
    }
}

// --- 4. ENVIAR MENSAJE AL BOT ---
formularioChat.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textoUsuario = inputMensaje.value.trim();
    if (!textoUsuario || !personajeActivoId) return;

    const msjVacioInfo = ventanaChat.querySelector('.msj-vacio');
    if (msjVacioInfo) msjVacioInfo.remove();

    inputMensaje.value = '';
    inputMensaje.disabled = true;
    btnEnviar.disabled = true;
    inputMensaje.placeholder = 'La IA está escribiendo...';

    inyectarMensaje('user', textoUsuario);

    try {
        await supabase.from('mensajes').insert([
            { personaje_id: personajeActivoId, rol: 'user', contenido: textoUsuario }
        ]);

        const { data: historial } = await supabase
            .from('mensajes')
            .select('rol, contenido')
            .eq('personaje_id', personajeActivoId)
            .order('creado_en', { ascending: true });

        const mensajesParaIA = historial.map(msg => ({
            role: msg.rol === 'user' ? 'user' : 'assistant',
            content: msg.contenido
        }));

        mensajesParaIA.unshift({
            role: 'system',
            content: personajeActivoPrompt
        });

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensajes: mensajesParaIA })
        });

        if (!response.ok) throw new Error('Error al conectar con Vercel');

        const datosIA = await response.json();
        const textoIA = datosIA.choices[0].message.content;

        inyectarMensaje('assistant', textoIA);

        await supabase.from('mensajes').insert([
            { personaje_id: personajeActivoId, rol: 'assistant', contenido: textoIA }
        ]);

    } catch (error) {
        console.error(error);
        inyectarMensaje('assistant', "❌ Error de conexión. Revisa la consola.");
    } finally {
        inputMensaje.disabled = false;
        btnEnviar.disabled = false;
        inputMensaje.placeholder = `Escribe tu mensaje aquí...`;
        inputMensaje.focus();
    }
});

// --- 5. CREADOR DE PERSONAJES ---
btnNuevoPersonaje.addEventListener('click', () => modalCrear.classList.remove('hidden'));
btnCerrarModal.addEventListener('click', () => modalCrear.classList.add('hidden'));

formularioCrear.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = formularioCrear.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Creando...';

    const nombre = document.getElementById('nuevo-nombre').value.trim();
    const desc = document.getElementById('nueva-desc').value.trim();
    const prompt = document.getElementById('nuevo-prompt').value.trim();

    const { data, error } = await supabase.from('personajes').insert([
        { nombre: nombre, descripcion: desc, prompt_sistema: prompt }
    ]).select();

    if (!error && data && data.length > 0) {
        modalCrear.classList.add('hidden');
        formularioCrear.reset();
        await cargarPersonajes(); 
        seleccionarPersonaje(data[0].id, data[0].nombre, data[0].prompt_sistema); 
    } else {
        alert("Ocurrió un error al crear el personaje.");
        console.error(error);
    }
    
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Guardar y Chatear';
});

// --- INICIALIZACIÓN ---
cargarPersonajes();
