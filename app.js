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

// --- 1. FUNCIÓN PARA DIBUJAR BURBUJAS DE CHAT ---
function inyectarMensaje(rol, contenido) {
    const div = document.createElement('div');
    div.classList.add('max-w-[75%]', 'p-3', 'rounded-2xl', 'text-sm', 'md:text-base');
    
    if (rol === 'user') {
        div.classList.add('bg-blue-600', 'text-white', 'self-end', 'rounded-br-sm');
    } else {
        div.classList.add('bg-gray-700', 'text-gray-100', 'self-start', 'rounded-bl-sm');
    }
    
    div.textContent = contenido;
    ventanaChat.appendChild(div);
    ventanaChat.scrollTop = ventanaChat.scrollHeight; // Auto-scroll hacia abajo
}

// --- 2. ENVIAR MENSAJE A LA IA ---
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textoUsuario = inputMensaje.value.trim();
    if (!textoUsuario || !personajeActivoId) return;

    // Bloqueamos el input mientras la IA "piensa"
    inputMensaje.value = '';
    inputMensaje.disabled = true;
    btnEnviar.disabled = true;

    // Mostramos el mensaje del usuario en pantalla
    inyectarMensaje('user', textoUsuario);

    try {
        // A. Guardamos el mensaje del usuario en Supabase
        await supabase.from('mensajes').insert([
            { personaje_id: personajeActivoId, rol: 'user', contenido: textoUsuario }
        ]);

        // B. Le pedimos a Supabase el historial de esta conversación para darle memoria a la IA
        const { data: historial } = await supabase
            .from('mensajes')
            .select('rol, contenido')
            .eq('personaje_id', personajeActivoId)
            .order('creado_en', { ascending: true }); // Ordenamos del más viejo al más nuevo

        // Formateamos el historial para que la IA lo entienda
        const mensajesParaIA = historial.map(msg => ({
            role: msg.rol === 'user' ? 'user' : 'assistant',
            content: msg.contenido
        }));

        // C. Enviamos todo a nuestro archivo secreto en Vercel (el Escudo)
        const respuesta = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensajes: mensajesParaIA })
        });

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
        inyectarMensaje('assistant', "❌ Error de conexión con la red neuronal.");
    } finally {
        // Desbloqueamos el input
        inputMensaje.disabled = false;
        btnEnviar.disabled = false;
        inputMensaje.focus();
    }
});