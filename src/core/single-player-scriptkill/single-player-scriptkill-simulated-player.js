// Single Player ScriptKill V2 Simulated Players
// Simulated Player != role itself. It is a stranger trying to play assigned role.

const STRANGER_NAMES = ["小岚", "阿澈", "晴子", "南川", "白石", "小遥", "阿舟", "千夏", "若叶", "北川"];

function clamp(n, min = 0, max = 1) { return Math.max(min, Math.min(max, Number(n ?? 0.5))); }

export function createSimulatedPlayersForRoles(roleBooks = [], realPlayerRoleId = "", options = {}) {
  return roleBooks
    .filter(role => role.roleId !== realPlayerRoleId)
    .map((role, index) => createSimulatedPlayerForRole(role, { index, ...options }));
}

export function createSimulatedPlayerForRole(role = {}, options = {}) {
  const index = options.index || 0;
  const playerDisplayName = options.playerDisplayName || STRANGER_NAMES[index % STRANGER_NAMES.length];
  return {
    simulatedPlayerId: options.simulatedPlayerId || `ai_player_${index + 1}`,
    playerDisplayName,
    relationshipToRealUser: "stranger",
    userKnowsThisPlayer: false,
    assignedRoleId: role.roleId,
    assignedRoleName: role.roleName,
    visibilityPolicy: {
      defaultChatName: "role_name",
      showPlayerNameInChat: false,
      showPlayerNameInDebug: true,
      showPlayerNameInAssignmentScreen: true
    },
    playerStyle: {
      roleplaySkill: clamp(options.roleplaySkill ?? 0.65),
      deductionSkill: clamp(options.deductionSkill ?? 0.55),
      talkativeness: clamp(options.talkativeness ?? 0.45),
      defensiveness: clamp(options.defensiveness ?? inferDefensiveness(role)),
      cooperationBias: clamp(options.cooperationBias ?? 0.45)
    },
    behaviorPolicy: {
      tryToStayInRole: true,
      noOocSpeech: true,
      noMetaMention: true,
      noRealUserRelationship: true,
      avoidOmniscience: true,
      allowHumanLikeMistakes: true
    },
    currentState: {
      pressure: 0.15,
      trustTowardRealPlayer: 0.3,
      suspicionTowardRoles: {},
      revealedSecretIds: [],
      withheldSecretIds: (role.secrets || []).map(s => s.secretId).filter(Boolean)
    }
  };
}

export function getImmersiveSpeakerName({ simulatedPlayer = {}, role = {} } = {}) {
  if (simulatedPlayer.visibilityPolicy?.defaultChatName === "player_name") return simulatedPlayer.playerDisplayName || role.roleName || "未知玩家";
  return role.roleName || simulatedPlayer.assignedRoleName || "未知角色";
}

export function getAssignmentLabel({ simulatedPlayer = {}, role = {} } = {}) {
  return `${role.roleName || simulatedPlayer.assignedRoleName || "未知角色"}（模拟玩家：${simulatedPlayer.playerDisplayName || "陌生玩家"}）`;
}

export function buildRoleFirstMessageEnvelope({ text = "", simulatedPlayer = {}, role = {}, channel = "public", meta = {} } = {}) {
  return {
    messageId: meta.messageId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    channel,
    speaker: {
      speakerType: "simulated_player",
      simulatedPlayerId: simulatedPlayer.simulatedPlayerId,
      assignedRoleId: role.roleId || simulatedPlayer.assignedRoleId,
      displayMode: "role_name",
      visibleName: getImmersiveSpeakerName({ simulatedPlayer, role })
    },
    text: String(text || "").trim(),
    meta: {
      playerNameHidden: true,
      oocFiltered: meta.oocFiltered !== false,
      knowledgeChecked: meta.knowledgeChecked === true,
      ...meta
    }
  };
}

function inferDefensiveness(role = {}) {
  const secrets = role.secrets || [];
  const mustConceal = role.roleSecretPolicy?.mustConceal || [];
  return secrets.length || mustConceal.length ? 0.7 : 0.45;
}
