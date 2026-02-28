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
const btnLimpiarChat = document.getElementById('btn-limpiar-chat');

const modalCrear = document.getElementById('modal-crear');
const btnNuevoPersonaje = document.getElementById('btn-nuevo-personaje');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const formularioCrear = document.getElementById('formulario-crear');

// --- REFERENCIAS NUEVAS: MI PERFIL ---
const modalPerfil = document.getElementById('modal-perfil');
const btnMiPerfil = document.getElementById('btn-mi-perfil');
const btnCerrarPerfil = document.getElementById('btn-cerrar-perfil');
const formularioPerfil = document.getElementById('formulario-perfil');
const inputPerfilNombre = document.getElementById('perfil-nombre');
const inputPerfilAspecto = document.getElementById('perfil-aspecto');

// --- 1. DIBUJAR BURBUJAS DE CHAT ---
function inyectarMensaje(rol, contenido) {
    const divBurbuja = document.createElement('div');
    divBurbuja.classList.add('max-w-[85%]', 'md:max-w-[75%]', 'p-4', 'rounded-2xl', 'text-sm', 'sm:text-base', 'break-words', 'shadow-sm', 'w-fit', 'markdown-content');
    
    const fila = document.createElement('div');
    fila.classList.add('flex', 'w-full');

    if (rol === 'user') {
        fila.classList.add('justify-end'); 
        divBurbuja.classList.add('bg-blue-600', 'text-white', 'rounded-br-sm');
    } else if (rol === 'error') {
        fila.classList.add('justify-center', 'my-2'); 
        divBurbuja.classList.add('bg-red-900/50', 'text-red-200', 'border', 'border-red-700', 'text-xs', 'text-center');
    } else {
        fila.classList.add('justify-start'); 
        divBurbuja.classList.add('bg-gray-800', 'text-gray-100', 'border', 'border-gray-700', 'rounded-bl-sm');
    }
    
    if (rol === 'error') {
        divBurbuja.textContent = contenido;
    } else {
        divBurbuja.innerHTML = contenido ? marked.parse(contenido) : '<span class="animate-pulse">...</span>'; 
    }
    
    fila.appendChild(divBurbuja);
    ventanaChat.appendChild(fila);
    ventanaChat.scrollTop = ventanaChat.scrollHeight; 

    return divBurbuja; 
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
    
    btnLimpiarChat.classList.remove('hidden');
    
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
        mostrarMensajeVacio('Aún no hay mensajes. ¡Inicia la conversación!');
    }
}

function mostrarMensajeVacio(texto) {
    const msjVacio = document.createElement('p');
    msjVacio.className = 'text-center text-gray-500 text-sm mt-4 msj-vacio';
    msjVacio.textContent = texto;
    ventanaChat.appendChild(msjVacio);
}

// --- 4. ENVIAR MENSAJE AL BOT (CON INYECCIÓN DE IDENTIDAD) ---
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

        const historialLimpio = historial.filter(msg => msg.rol === 'user' || msg.rol === 'assistant');

        const mensajesParaIA = historialLimpio.map(msg => ({
            role: msg.rol,
            content: msg.contenido
        }));

        // --- CONSTRUIMOS EL CEREBRO DE LA IA (PROMPT + TU IDENTIDAD) ---
        let systemCompleto = personajeActivoPrompt;
        
        const miNombre = localStorage.getItem('miNombre');
        const miAspecto = localStorage.getItem('miAspecto');

        // Si configuraste tu identidad, le damos una orden estricta a la IA para que lo use
        if (miNombre || miAspecto) {
            systemCompleto += `\n\n[INFORMACIÓN DEL USUARIO ESTRICTA: El usuario con el que interactúas se llama "${miNombre || 'Usuario'}". Su descripción y actitud es: "${miAspecto || 'Desconocida'}". Debes adaptar tus respuestas a este perfil, reconocerlo por su nombre y reaccionar a su apariencia si es relevante.]`;
        }

        mensajesParaIA.unshift({
            role: 'system',
            content: systemCompleto
        });

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensajes: mensajesParaIA })
        });

        if (!response.ok) {
            let mensajeError = `Error desconocido (${response.status})`;
            if (response.status === 504) mensajeError = "⏳ La IA tardó demasiado. Vercel cortó la conexión.";
            if (response.status === 429) mensajeError = "🚦 Servidores saturados. Reintenta en unos segundos.";
            if (response.status === 404) mensajeError = "🚫 Modelo no encontrado en OpenRouter.";
            throw new Error(mensajeError);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let textoCompletoIA = "";
        let buffer = ""; 
        
        const burbujaEnVivo = inyectarMensaje('assistant', '');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break; 

            buffer += decoder.decode(value, { stream: true });
            const lineas = buffer.split('\n');
            buffer = lineas.pop(); 

            for (const linea of lineas) {
                const lineaLimpia = linea.trim();
                
                if (lineaLimpia.startsWith('data: ') && !lineaLimpia.includes('[DONE]')) {
                    try {
                        const data = JSON.parse(lineaLimpia.replace(/^data: /, ''));
                        if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                            textoCompletoIA += data.choices[0].delta.content;
                            burbujaEnVivo.innerHTML = marked.parse(textoCompletoIA);
                            ventanaChat.scrollTop = ventanaChat.scrollHeight;
                        }
                    } catch (err) {
                        console.warn("Pedazo incompleto ignorado por ahora", err);
                    }
                }
            }
        }

        if (textoCompletoIA.trim() !== "") {
            await supabase.from('mensajes').insert([
                { personaje_id: personajeActivoId, rol: 'assistant', contenido: textoCompletoIA }
            ]);
        }

    } catch (error) {
        console.error(error);
        inyectarMensaje('error', `❌ ${error.message}`);
    } finally {
        inputMensaje.disabled = false;
        btnEnviar.disabled = false;
        inputMensaje.placeholder = `Escribe tu mensaje o acción usando *asteriscos*...`;
        inputMensaje.focus();
    }
});

// --- 5. BOTONES DE VENTANAS Y LIMPIEZA ---
btnLimpiarChat.addEventListener('click', async () => {
    if (!personajeActivoId) return;
    const confirmar = confirm(`¿Estás seguro de que quieres borrar toda la memoria de este chat?`);
    if (!confirmar) return;

    try {
        const { error } = await supabase.from('mensajes').delete().eq('personaje_id', personajeActivoId);
        if (error) throw error;
        ventanaChat.innerHTML = '';
        mostrarMensajeVacio('Memoria borrada. ¡La historia comienza de nuevo!');
        inputMensaje.focus();
    } catch (error) {
        alert("Ocurrió un error al intentar borrar la memoria.");
    }
});

// Modal Personajes
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
    }
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Guardar';
});

// --- NUEVO: LÓGICA DE MI PERFIL (IDENTIDAD DE ROL) ---
btnMiPerfil.addEventListener('click', () => {
    // Cargamos los datos guardados previamente
    inputPerfilNombre.value = localStorage.getItem('miNombre') || '';
    inputPerfilAspecto.value = localStorage.getItem('miAspecto') || '';
    modalPerfil.classList.remove('hidden');
});

btnCerrarPerfil.addEventListener('click', () => modalPerfil.classList.add('hidden'));

formularioPerfil.addEventListener('submit', (e) => {
    e.preventDefault();
    // Guardamos la identidad en la memoria del navegador
    localStorage.setItem('miNombre', inputPerfilNombre.value.trim());
    localStorage.setItem('miAspecto', inputPerfilAspecto.value.trim());
    
    modalPerfil.classList.add('hidden');
    alert("¡Identidad actualizada! En tu próximo mensaje la IA ya sabrá quién eres.");
});

// --- INICIALIZACIÓN ---
cargarPersonajes();
