export function validateBranchId(branchId = "") { return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(branchId) && !["shared", "runtime", "branches"].includes(branchId); }
export function assertBranchId(branchId) { if (!validateBranchId(branchId)) throw new Error(`invalid branch id: ${branchId}`); return branchId; }
