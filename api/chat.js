export const config = {
  runtime: 'edge', 
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const mensajes = body.mensajes;

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://mi-chat-ia.vercel.app', // Tu URL
        'X-Title': 'Plataforma IA',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Seguimos con Trinity que te está dando respuestas increíbles
        model: 'arcee-ai/trinity-large-preview:free',
        messages: mensajes,
        stream: true, // Mantenemos el efecto de máquina de escribir
        temperature: 0.9, // Hacemos que sea más creativo e impredecible
        repetition_penalty: 1.15 // El freno: evita que se quede atrapado en un bucle repitiendo frases
      })
    });

    // Si hay un error de servidor (ej. 429 o 404), pasamos el error a la pantalla
    if (!openRouterRes.ok) {
        const errorData = await openRouterRes.json();
        return new Response(JSON.stringify(errorData), { status: openRouterRes.status });
    }

    // Devolvemos el chorro de datos en vivo (Streaming) a tu página web
    return new Response(openRouterRes.body, {
      status: 200,
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error("Error interno:", error);
    return new Response(JSON.stringify({ error: 'Fallo al conectar con la nube' }), { status: 500 });
  }
}
