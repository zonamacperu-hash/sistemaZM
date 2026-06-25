export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Si es una solicitud a la API (/api/*), redirigirla al Worker de Cloudflare
  if (url.pathname.startsWith('/api/')) {
    // Buscar si existe un Service Binding al Worker.
    // Cloudflare Pages permite enlazar el Worker mediante Service Bindings.
    // Los nombres comunes de binding son "API", "BACKEND", "sistemazm", "worker".
    const binding = context.env.API || context.env.BACKEND || context.env.sistemazm || context.env.worker;

    if (binding && typeof binding.fetch === 'function') {
      return await binding.fetch(context.request);
    }

    // Si no hay Service Binding, buscar si se configuró la variable de entorno API_HOST o BACKEND_URL
    const apiHost = context.env.API_HOST || context.env.BACKEND_URL;
    if (apiHost) {
      const targetUrl = new URL(url.pathname + url.search, apiHost);
      return await fetch(new Request(targetUrl.toString(), context.request));
    }

    // Si no está configurado, podemos intentar deducir el Host del Worker
    // En Cloudflare Workers, si el Pages está en algo.pages.dev,
    // el Worker podría estar en sistemazm.<subdomain>.workers.dev.
    // Pero es más seguro devolver un error descriptivo con instrucciones de configuración.
    return new Response(JSON.stringify({
      success: false,
      error: "Backend no configurado en Cloudflare Pages. Por favor, realiza una de las siguientes opciones:\n" +
             "1. Vincula tu Worker 'sistemazm' en la configuración de tu proyecto de Pages en Cloudflare (Settings > Functions > Service Bindings) con el nombre 'API' o 'BACKEND'.\n" +
             "2. O bien, agrega una variable de entorno en tu proyecto de Pages llamada 'API_HOST' apuntando a la URL de tu Worker (ej. https://sistemazm.tu-subdominio.workers.dev)."
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // Para cualquier otra solicitud que no sea de la API, dejar que Pages sirva los archivos estáticos (index.html, app.js, style.css, etc.)
  return await context.next();
}
