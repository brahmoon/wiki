const HERO_DB_PATH = './database/hero_db.json';
const SKILL_DB_PATH = './database/skill_db.json';
const ROW_KEYS = ['row1', 'row2'];
const USER_SKILL_KEYS = ['skill3', 'skill4'];

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

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return await response.json();
}

async function loadHeroSkillsetData() {
  if (!cachedDataPromise) {
    cachedDataPromise = Promise.all([
      fetchJson(HERO_DB_PATH),
      fetchJson(SKILL_DB_PATH)
    ]).then(([heroes, skills]) => {
      const heroMap = new Map();
      const skillMap = new Map();
      heroes.forEach(hero => {
        if (hero?.id) {
          heroMap.set(hero.id, hero);
        }
      });
      skills.forEach(skill => {
        if (skill?.id) {
          skillMap.set(skill.id, skill);
        }
      });
      return {
        heroes,
        skills,
        heroMap,
        skillMap,
        selectableSkills: skills.filter(skill => skill?.category === 'user')
      };
    }).catch(error => {
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
    const sourceSkills = sourceRow.userSkills && typeof sourceRow.userSkills === 'object'
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
  ROW_KEYS,
  USER_SKILL_KEYS
};

if (typeof window !== 'undefined') {
  window.HeroSkillsetService = exported;
}

export {
  loadHeroSkillsetData,
  getDefaultHeroSkillsetConfig,
  normalizeHeroSkillsetConfig,
  encodeHeroSkillsetConfig,
  ROW_KEYS,
  USER_SKILL_KEYS
};
