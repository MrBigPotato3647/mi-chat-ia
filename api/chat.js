export default async function handler(req, res) {
  // Solo permitimos peticiones POST (enviar mensajes)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Recibimos el historial de mensajes que nos mandará nuestro frontend
  const { mensajes } = req.body; 

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        // Aquí Vercel inyectará tu clave secreta de forma invisible
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://mi-chat-ia.vercel.app', 
        'X-Title': 'Plataforma IA',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Este es el modelo gratuito y "sin filtro" que investigamos
        model: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
        messages: mensajes
      })
    });

    const data = await response.json();
    res.status(200).json(data);
    
  } catch (error) {
    console.error("Error al conectar con la IA:", error);
    res.status(500).json({ error: 'Fallo interno en el servidor de la IA' });
  }
}