export function addScene(chain = {}, scene = {}) {
  const scenes = Array.isArray(chain.scenes) ? chain.scenes : [];
  return { ...chain, scenes: [...scenes, { ...scene, id: scene.id || `scene-${Date.now()}`, createdAt: new Date().toISOString() }] };
}

export function rotateChain(chain = {}, max = 8) {
  const scenes = Array.isArray(chain.scenes) ? chain.scenes : [];
  return { ...chain, scenes: scenes.slice(Math.max(0, scenes.length - max)) };
}

export function getContextWindow(chain = {}, budget = {}) {
  const count = budget.sceneCount || 5;
  return rotateChain(chain, count).scenes || [];
}

export function summarizeScene(input = "", narrative = "") {
  return {
    title: String(input || "场景").slice(0, 48),
    summary: String(narrative || input || "").slice(0, 360),
    createdAt: new Date().toISOString()
  };
}
