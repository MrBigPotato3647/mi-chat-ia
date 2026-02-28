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
        'HTTP-Referer': 'https://mi-chat-ia.vercel.app',
        'X-Title': 'Plataforma IA',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: mensajes,
        stream: true,
        temperature: 0.8, // Un poco más bajo para evitar que se vuelva loco e invente cosas
        frequency_penalty: 0.7, // Penaliza usar las mismas palabras, rompiendo el bucle del "susurro siniestro"
        presence_penalty: 0.5 // Obliga a la IA a avanzar la historia y hablar de cosas nuevas
      })
    });

    if (!openRouterRes.ok) {
        const errorData = await openRouterRes.json();
        return new Response(JSON.stringify(errorData), { status: openRouterRes.status });
    }

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
