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

function normalizeFixedSkillEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const name = normalizeString(entry.name);
  const description = normalizeString(entry.description);
  const type = normalizeString(entry.type);
  const image = normalizeString(entry.image);
  const id = normalizeString(entry.id || name);

  if (!id && !name && !description && !image) {
    return null;
  }

  return { id, name, type, description, image };
}

function normalizeFixedSkillIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeString).filter(Boolean);
}

function normalizeEmbeddedFixedSkills(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(entry => (typeof entry === 'object' ? normalizeFixedSkillEntry(entry) : null))
    .filter(Boolean);
}

/**
 * 英雄レコード正規化
 */
function normalizeHeroRecord(record) {
  const fixedSkills = normalizeFixedSkills(record?.fixedSkills || []);
  const embeddedFixedSkills = normalizeEmbeddedFixedSkills(record?.fixedSkillIds || []);

  const normalized = {
    id: normalizeString(record?.id),
    name: normalizeString(record?.name),
    image: normalizeString(record?.image),
    url: normalizeString(record?.url),
    troopType: normalizeString(record?.troopType),
    grade: normalizeString(record?.grade),

    fixedSkillIds: normalizeFixedSkillIds(record?.fixedSkillIds || []),

    // 🔥 fixedSkills（新仕様）だけを採用。fixedSkillIds にオブジェクトが渡された場合もここで取り込む。
    fixedSkills: fixedSkills.length ? fixedSkills : embeddedFixedSkills
  };

  HERO_TALENT_KEYS.forEach(key => {
    normalized[key] = normalizeTalentEntry(record?.[key]);
  });

  return normalized;
}

function normalizeSkillRecord(record) {
  const rawCategory = record?.category;
  // category が空ならデフォルトで 'user' とみなす
  const category = normalizeString(rawCategory) || 'user';

  return {
    id: normalizeId(record?.id),              // ★ 数値IDにも対応
    name: normalizeString(record?.name),
    image: normalizeString(record?.image),
    description: normalizeString(record?.description),
    url: normalizeString(record?.url),
    category,                                 // ★ デフォルト 'user'
    skillType: normalizeString(record?.skillType),
    grade: normalizeString(record?.grade)
  };
+}

async function loadFromDatabaseEndpoint() {
  if (!DATABASE_ENDPOINT || DATABASE_ENDPOINT.includes('YOUR_DATABASE_DEPLOYMENT_ID')) {
    throw new Error('Apps Script endpoint is not configured.');
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

  const selectableSkills = (skills || []).filter(skill => {
    // category が 'user' または空/未定義ならユーザ選択スキルとして扱う
    return !skill?.category || skill.category === 'user';
  });
  
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
        return databaseData;
      } catch (error) {
        console.warn('[HeroSkillsetService] Failed to load data from Apps Script endpoint.', error);
        throw error;
      }
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

function normalizeId(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  // 数値やその他は文字列化
  return String(value);
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
