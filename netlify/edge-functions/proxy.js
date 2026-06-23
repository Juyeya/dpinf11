const TARGET_API = "https://api.deepinfra.com";

const PATH_MAPPINGS = {
  "/hf/v1/chat": "/v1/openai/chat",
  "/hf/v1/models": "/v1/openai/models",
  "/hf/v1/messages": "/anthropic/v1/messages"
};

export default async (request) => {
  const url = new URL(request.url);

  // 1. 根路径返回 "service running."
  if (url.pathname === "/" || url.pathname === "") {
    return new Response("service running.", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // 2. 路径映射匹配与重写
  let pathname = url.pathname;
  for (const [originalPath, newPath] of Object.entries(PATH_MAPPINGS)) {
    if (pathname.startsWith(originalPath)) {
      pathname = pathname.replace(originalPath, newPath);
      break;
    }
  }

  // 构建目标 URL（保留原始的 Query 参数）
  const targetUrl = `${TARGET_API}${pathname}${url.search}`;

  // 3. Header 过滤逻辑（仅保留白名单内的 Header）
  const ESSENTIAL_HEADERS = ['content-type', 'accept', 'user-agent', 'x-deepinfra-turnstile'];
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (ESSENTIAL_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  // 4. 构建 Fetch 请求参数
  const fetchOptions = {
    method: request.method,
    headers: headers,
  };

  // 仅在有请求体的方法中带上 body（直接转发流，无需手动解析 JSON）
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && request.body) {
    fetchOptions.body = request.body;
  }

  try {
    // 发起请求
    const response = await fetch(targetUrl, fetchOptions);

    // 5. 过滤响应 Header
    const responseHeaders = new Headers();
    const IGNORED_HEADERS = ['content-length', 'transfer-encoding', 'connection'];
    for (const [key, value] of response.headers.entries()) {
      if (!IGNORED_HEADERS.includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    }

    // 6. 返回响应（由于传入的是 response.body 流，Netlify 会自动流式传输给客户端）
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(`Proxy Error: ${error.message}`, { status: 502 });
  }
};

// 配置该 Edge Function 拦截所有请求
export const config = { path: "/*" };
