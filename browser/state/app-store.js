"use strict";

(function registerWorldTreeStore(global) {
  const initialState = Object.freeze({ view: "workbench", activeProjectId: "", saveStatus: "idle", modelStatus: "unconfigured", mobileNavOpen: false });

  function reducer(state, action = {}) {
    if (action.type === "navigation/view" && global.WorldTreeNavigation?.hasView(action.view)) return { ...state, view: action.view, mobileNavOpen: false };
    if (action.type === "project/select") return { ...state, activeProjectId: String(action.projectId || "") };
    if (action.type === "save/status") return { ...state, saveStatus: String(action.status || "idle") };
    if (action.type === "model/status") return { ...state, modelStatus: String(action.status || "unconfigured") };
    if (action.type === "mobile/toggle") return { ...state, mobileNavOpen: !state.mobileNavOpen };
    return state;
  }

  function createStore(seed = {}) {
    let state = { ...initialState, ...seed };
    const listeners = new Set();
    return Object.freeze({
      getState() { return { ...state }; },
      dispatch(action) {
        const next = reducer(state, action);
        if (next !== state) {
          state = next;
          for (const listener of listeners) listener({ ...state }, action);
        }
        return { ...state };
      },
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    });
  }

  global.WorldTreeAppStore = Object.freeze({ initialState, reducer, createStore });
})(globalThis);
