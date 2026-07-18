export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.detail || `HTTP ${response.status}`);
  }

  return payload;
}

export async function postFile(url, file, options = {}) {
  const formData = new FormData();
  formData.append("file", file);

  return fetchJson(url, {
    method: "POST",
    body: formData,
    ...options
  });
}
