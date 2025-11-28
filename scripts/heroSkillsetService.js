const HERO_DB_PATH = './database/hero_db.json';
const SKILL_DB_PATH = './database/skill_db.json';
const DATABASE_ENDPOINT = typeof window !== 'undefined' ? window.APPS_SCRIPT_ENDPOINT_DATABASE : '';
const LOGIN_STORAGE_KEY = 'wikiLoginState';

const ROW_KEYS = ['row1', 'row2'];
const USER_SKILL_KEYS = ['skill3', 'skill4'];
const HERO_TALENT_KEYS = ['talent1', 'talent2', 'talent3', 'talent4', 'talent5', 'talent6'];

function createEmptyUserSkills() {
  return USER_SKILL_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

function createDefaultRowsConfig() {
  return ROW_KEYS.reduce((acc, rowKey) => {
    acc[rowKey] = { heroId: null, userSkills: createEmptyUserSkills() };
    return acc;
  }, {});
}

const DEFAULT_CONFIG = {
  rows: createDefaultRowsConfig()
};

let cachedDataPromise = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTalentEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const name = typeof entry.name === 'string' ? entry.name : '';
  const type = typeof entry.type === 'string' ? entry.type : '';
  const description = typeof entry.description === 'string' ? entry.description : '';
  if (!name && !description) {
    return null;
  }
  return { name, type, description };
}

function getHeroTalents(hero) {
  if (!hero || typeof hero !== 'object') {
    return [];
  }
  return HERO_TALENT_KEYS.map(key => normalizeTalentEntry(hero[key])).filter(Boolean);
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return await response.json();
}

function getLoginState() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * fixedSkills（新仕様）を正規化
 * - ID 形式への変換はしない（HeroSkillsetCard が ID を使わないため）
 * - name/type/description/image がそのまま UI に渡る
 */
function normalizeFixedSkills(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(entry => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const name = normalizeString(entry.name);
      const description = normalizeString(entry.description);
      const type = normalizeString(entry.type);
      const image = normalizeString(entry.image);
      const id = normalizeString(entry.id || name);

      // 最低限の情報がない場合は無視
      if (!name && !description && !image && !id) {
        return null;
      }

      return { id, name, type, description, image };
    })
    .filter(Boolean);
}

function normalizeFixedSkillIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeString).filter(Boolean);
}

/**
 * 英雄レコード正規化
 */
function normalizeHeroRecord(record) {
  const normalized = {
    id: normalizeString(record?.id),
    name: normalizeString(record?.name),
    image: normalizeString(record?.image),
    url: normalizeString(record?.url),
    troopType: normalizeString(record?.troopType),
    grade: normalizeString(record?.grade),

    fixedSkillIds: normalizeFixedSkillIds(record?.fixedSkillIds || []),

    // 🔥 fixedSkills（新仕様）だけを採用
    fixedSkills: normalizeFixedSkills(record?.fixedSkills || [])
  };

  HERO_TALENT_KEYS.forEach(key => {
    normalized[key] = normalizeTalentEntry(record?.[key]);
  });

  return normalized;
}

function normalizeSkillRecord(record) {
  return {
    id: normalizeString(record?.id),
    name: normalizeString(record?.name),
    image: normalizeString(record?.image),
    description: normalizeString(record?.description),
    url: normalizeString(record?.url),
    category: normalizeString(record?.category),
    skillType: normalizeString(record?.skillType),
    grade: normalizeString(record?.grade)
  };
}

async function loadFromDatabaseEndpoint() {
  if (!DATABASE_ENDPOINT || DATABASE_ENDPOINT.includes('YOUR_DATABASE_DEPLOYMENT_ID')) {
    return null;
  }

  const loginState = getLoginState();
  const user = loginState?.user || {};

  const payload = {
    action: 'getHeroSkillsetData',
    playerId: user.playerId || '',
    email: user.email || ''
  };

  const response = await fetch(DATABASE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to load hero skillset data (HTTP ${response.status})`);
  }

  const result = await response.json();
  if (!result?.success || !Array.isArray(result.heroes) || !Array.isArray(result.skills)) {
    throw new Error(result?.message || 'Unexpected response from database endpoint');
  }

  const heroes = result.heroes.map(normalizeHeroRecord);
  const skills = result.skills.map(normalizeSkillRecord);

  return buildDataStore(heroes, skills);
}

async function loadFromLocalFiles() {
  const [heroes, skills] = await Promise.all([
    fetchJson(HERO_DB_PATH),
    fetchJson(SKILL_DB_PATH)
  ]);
  return buildDataStore(heroes, skills);
}

/**
 * fixedSkills を skillMap にも登録する（DB consistency 用）
 * HeroSkillsetCard は ID を使わないので UI 表示には影響しない。
 */
function buildDataStore(heroes, skills) {
  const heroMap = new Map();
  const skillMap = new Map();

  (heroes || []).forEach(hero => {
    if (hero?.id) heroMap.set(hero.id, hero);
  });

  (skills || []).forEach(skill => {
    if (skill?.id) skillMap.set(skill.id, skill);
  });

  // fixedSkills も skillMap に登録する（重複は無視）
  (heroes || []).forEach(hero => {
    if (!Array.isArray(hero?.fixedSkills)) return;

    hero.fixedSkills.forEach(skill => {
      if (!skill?.id) return;
      if (!skillMap.has(skill.id)) {
        skillMap.set(skill.id, {
          ...skill,
          category: skill.category || 'hero'
        });
      }
    });
  });

  // fixedSkillIds から fixedSkills を解決
  (heroes || []).forEach(hero => {
    const fixedSkills = Array.isArray(hero?.fixedSkills) ? hero.fixedSkills : [];
    const fixedSkillIds = Array.isArray(hero?.fixedSkillIds) ? hero.fixedSkillIds : [];

    if (!fixedSkills.length && fixedSkillIds.length) {
      hero.fixedSkills = fixedSkillIds.map(id => skillMap.get(id)).filter(Boolean);
    }
  });

  const selectableSkills = (skills || []).filter(skill => skill?.category === 'user');

  return {
    heroes: heroes || [],
    skills: skills || [],
    heroMap,
    skillMap,
    selectableSkills
  };
}

async function loadHeroSkillsetData() {
  if (!cachedDataPromise) {
    cachedDataPromise = (async () => {
      try {
        const databaseData = await loadFromDatabaseEndpoint();
        if (databaseData) return databaseData;
      } catch (error) {
        console.warn('[HeroSkillsetService] Failed to load data from Apps Script endpoint. Falling back to local data.', error);
      }

      return await loadFromLocalFiles();
    })().catch(error => {
      cachedDataPromise = null;
      throw error;
    });
  }
  return cachedDataPromise;
}

function getDefaultHeroSkillsetConfig() {
  return clone(DEFAULT_CONFIG);
}

function normalizeHeroSkillsetConfig(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (_error) {
      parsed = null;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return getDefaultHeroSkillsetConfig();
  }

  const normalized = getDefaultHeroSkillsetConfig();
  const sourceRows = parsed.rows && typeof parsed.rows === 'object' ? parsed.rows : parsed;

  ROW_KEYS.forEach(rowKey => {
    const sourceRow = sourceRows[rowKey];
    if (!sourceRow || typeof sourceRow !== 'object') {
      return;
    }

    if (typeof sourceRow.heroId === 'string') {
      normalized.rows[rowKey].heroId = sourceRow.heroId;
    }

    const sourceSkills =
      sourceRow.userSkills && typeof sourceRow.userSkills === 'object'
        ? sourceRow.userSkills
        : sourceRow;

    USER_SKILL_KEYS.forEach(skillKey => {
      const candidate = sourceRow[skillKey] ?? sourceSkills[skillKey];
      if (typeof candidate === 'string') {
        normalized.rows[rowKey].userSkills[skillKey] = candidate;
      }
    });
  });

  return normalized;
}

function encodeHeroSkillsetConfig(config) {
  const normalized = normalizeHeroSkillsetConfig(config);
  return JSON.stringify(normalized);
}

const exported = {
  loadHeroSkillsetData,
  getDefaultHeroSkillsetConfig,
  normalizeHeroSkillsetConfig,
  encodeHeroSkillsetConfig,
  getHeroTalents,
  ROW_KEYS,
  USER_SKILL_KEYS,
  HERO_TALENT_KEYS
};

if (typeof window !== 'undefined') {
  window.HeroSkillsetService = exported;
}

export {
  loadHeroSkillsetData,
  getDefaultHeroSkillsetConfig,
  normalizeHeroSkillsetConfig,
  encodeHeroSkillsetConfig,
  getHeroTalents,
  ROW_KEYS,
  USER_SKILL_KEYS,
  HERO_TALENT_KEYS
};
