export async function fetchActiveLayout(store){return fetchJson(`/api/stores/${encodeURIComponent(store)}/layouts/active`)}
export async function fetchStoreBarcodes(store){return fetchJson(`/api/stores/${encodeURIComponent(store)}/barcodes`)}
export async function sendAssignment(a){return fetchJson('/api/assignments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,updatedAt:a.updatedAt||a.createdAt||new Date().toISOString()})})}
async function fetchJson(url,opt={}){const r=await fetch(url,{cache:'no-store',...opt});const p=await r.json();if(!r.ok)throw new Error(p.detail||`HTTP ${r.status}`);return p}
