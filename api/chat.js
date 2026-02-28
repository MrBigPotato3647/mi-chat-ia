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
        // Cambiamos a Toppy 7B: 100% gratuito, rapidísimo y sin censura
        model: 'openrouter/free',
        messages: mensajes
      })
    });

    const data = await openRouterRes.json();
    
    // Si OpenRouter nos rechaza, pasamos el error exacto
    if (!openRouterRes.ok) {
        return new Response(JSON.stringify(data), { status: openRouterRes.status });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Error interno:", error);
    return new Response(JSON.stringify({ error: 'Fallo al conectar con la nube' }), { status: 500 });
  }
}

