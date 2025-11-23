import { Node } from 'https://esm.sh/@tiptap/core';
import {
  loadHeroSkillsetData,
  getDefaultHeroSkillsetConfig,
  normalizeHeroSkillsetConfig,
  encodeHeroSkillsetConfig,
  getHeroTalents,
  ROW_KEYS,
  USER_SKILL_KEYS
} from '../../scripts/heroSkillsetService.js';

let selectionOverlayInstance = null;
const LOGIN_STORAGE_KEY = 'wikiLoginState';
const DEVELOPER_AUTHORITY_VALUE = 4;

function getUserAuthorityLevel() {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const authority = parsed?.user?.authority;
    const number = Number(authority);
    return Number.isFinite(number) ? number : null;
  } catch (error) {
    console.warn('[HeroSkillsetCard] Failed to read login authority from storage.', error);
    return null;
  }
}

function createEmptyUserSkills() {
  return USER_SKILL_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

function createEmptyRowConfig() {
  return { heroId: null, userSkills: createEmptyUserSkills() };
}

function cloneConfig(config) {
  return normalizeHeroSkillsetConfig(config);
}

function createSlotFigure(image, label, placeholderText = '+') {
  const figure = document.createElement('div');
  figure.className = 'hero-skillset-cell__figure';
  if (image) {
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = image.alt || label || '';
    figure.appendChild(img);
  } else {
    const span = document.createElement('span');
    span.className = 'hero-skillset-cell__placeholder';
    span.textContent = placeholderText;
    figure.appendChild(span);
  }
  return figure;
}

function createHeroSlotButton(rowKey, hero) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hero-skillset-cell hero-skillset-cell--hero';
  button.dataset.heroSlot = 'true';
  button.dataset.row = rowKey;
  button.setAttribute('aria-label', hero ? `${hero.name} を変更` : '英雄を選択');
  const figure = createSlotFigure(hero ? { src: hero.image, alt: hero.name } : null, hero?.name || '', '+');
  const label = document.createElement('span');
  label.className = 'hero-skillset-cell__label';
  label.textContent = hero?.name || '英雄を選択';
  if (!hero) {
    button.classList.add('is-empty');
  }
  button.append(figure, label);
  return button;
}

function createSkillSlotElement({ rowKey, slotKey, skill, editable }) {
  const element = document.createElement(editable ? 'button' : 'div');
  if (editable) {
    element.type = 'button';
    element.dataset.skillSlot = slotKey;
    element.dataset.row = rowKey;
    element.setAttribute('aria-label', skill ? `${skill.name} を変更` : 'スキルを選択');
  }
  element.className = `hero-skillset-cell hero-skillset-cell--skill ${editable ? 'hero-skillset-cell--editable' : 'hero-skillset-cell--fixed'}`;
  const figure = createSlotFigure(skill ? { src: skill.image, alt: skill.name } : null, skill?.name || '', editable ? '+' : '—');
  const label = document.createElement('span');
  label.className = 'hero-skillset-cell__label';
  if (skill) {
    label.textContent = skill.name;
  } else if (editable) {
    label.textContent = 'スキルを選択';
    element.classList.add('is-empty');
  } else {
    label.textContent = '英雄未選択';
    element.classList.add('is-empty');
  }
  element.append(figure, label);
  return element;
}

function getHeroTalentSummary(hero) {
  const talents = getHeroTalents(hero);
  if (!talents.length) {
    return '才能情報が登録されていません。';
  }
  return talents.slice(0, 2).map(talent => {
    if (talent.type) {
      return `${talent.name}（${talent.type}）`;
    }
    return talent.name;
  }).join(' / ');
}

function getSelectionOverlay() {
  if (selectionOverlayInstance) {
    return selectionOverlayInstance;
  }
  const overlay = document.createElement('div');
  overlay.className = 'hero-skillset-overlay';
  const panel = document.createElement('div');
  panel.className = 'hero-skillset-overlay__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const title = document.createElement('h3');
  title.className = 'hero-skillset-overlay__title';
  const message = document.createElement('div');
  message.className = 'hero-skillset-overlay__message';
  const grid = document.createElement('div');
  grid.className = 'hero-skillset-overlay__grid';
  const footer = document.createElement('div');
  footer.className = 'hero-skillset-overlay__footer';
  const databaseButton = document.createElement('button');
  databaseButton.type = 'button';
  databaseButton.className = 'hero-skillset-overlay__action hero-skillset-overlay__db';
  databaseButton.textContent = 'DB編集';
  databaseButton.hidden = true;
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'hero-skillset-overlay__close hero-skillset-overlay__action';
  closeButton.textContent = '閉じる';
  footer.append(databaseButton, closeButton);
  panel.append(title, message, grid, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function hide() {
    overlay.classList.remove('is-visible');
    grid.innerHTML = '';
    message.textContent = '';
    databaseButton.hidden = true;
    databaseButton.onclick = null;
  }

  closeButton.addEventListener('click', hide);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      hide();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay.classList.contains('is-visible')) {
      hide();
    }
  });

  selectionOverlayInstance = {
    open({ title: overlayTitle, items, allowClear, onSelect, onClear, emptyMessage, databaseType }) {
      title.textContent = overlayTitle || '';
      grid.innerHTML = '';
      message.textContent = '';
      databaseButton.hidden = true;
      databaseButton.onclick = null;

      const authority = getUserAuthorityLevel();
      const canEditDatabase = databaseType && authority !== null && authority >= DEVELOPER_AUTHORITY_VALUE;
      if (canEditDatabase) {
        const type = databaseType === 'skill' ? 'skill' : 'hero';
        databaseButton.hidden = false;
        databaseButton.onclick = () => {
          window.open(`./database.html?data=${type}`, '_blank', 'noopener');
        };
      }
      if (allowClear) {
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'hero-skillset-overlay__clear';
        clearButton.textContent = '選択を解除';
        clearButton.addEventListener('click', () => {
          onClear?.();
          hide();
        }, { once: true });
        grid.appendChild(clearButton);
      }
      if (!items.length) {
        message.textContent = emptyMessage || '選択肢がありません。';
      } else {
        items.forEach(item => {
          const option = document.createElement('button');
          option.type = 'button';
          option.className = 'hero-skillset-overlay__option';
          const imgWrapper = document.createElement('div');
          imgWrapper.className = 'hero-skillset-overlay__option-figure';
          if (item.image) {
            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.name || '';
            imgWrapper.appendChild(img);
          }
          const label = document.createElement('div');
          label.className = 'hero-skillset-overlay__option-label';
          label.textContent = item.name || '';
          option.append(imgWrapper, label);
          if (item.description) {
            const desc = document.createElement('div');
            desc.className = 'hero-skillset-overlay__option-description';
            desc.textContent = item.description;
            option.appendChild(desc);
          }
          option.addEventListener('click', () => {
            onSelect?.(item.id);
            hide();
          }, { once: true });
          grid.appendChild(option);
        });
      }
      overlay.classList.add('is-visible');
    }
  };
  return selectionOverlayInstance;
}

class HeroSkillsetCardNodeView {
  constructor(node, editor, getPos) {
    this.node = node;
    this.editor = editor;
    this.getPos = getPos;
    this.config = cloneConfig(node.attrs.configuration);
    this.serializedConfig = encodeHeroSkillsetConfig(this.config);
    this.dom = document.createElement('div');
    this.dom.className = 'hero-skillset-card hero-skillset-card--editing';
    this.dom.setAttribute('data-hero-skillset-card', '');
    this.dom.setAttribute('data-config', this.serializedConfig);
    this.dom.contentEditable = 'false';
    this.body = document.createElement('div');
    this.body.className = 'hero-skillset-card__body hero-skillset-slot';
    this.dom.appendChild(this.body);
    this.handleClick = this.handleClick.bind(this);
    this.dom.addEventListener('click', this.handleClick);
    this.render();
    void this.loadData();
  }

  async loadData() {
    try {
      this.data = await loadHeroSkillsetData();
      this.render();
    } catch (error) {
      console.error('英雄・スキルデータの読み込みに失敗しました。', error);
      this.body.innerHTML = '<div class="hero-skillset-card__status hero-skillset-card__status--error">データを読み込めませんでした。</div>';
    }
  }

  handleClick(event) {
    const heroSlot = event.target.closest('[data-hero-slot]');
    if (heroSlot) {
      const rowKey = heroSlot.dataset.row;
      if (rowKey) {
        event.preventDefault();
        this.openHeroPicker(rowKey);
      }
      return;
    }
    const skillSlot = event.target.closest('[data-skill-slot]');
    if (skillSlot) {
      const rowKey = skillSlot.dataset.row;
      const slotKey = skillSlot.dataset.skillSlot;
      if (rowKey && slotKey) {
        event.preventDefault();
        this.openSkillPicker(rowKey, slotKey);
      }
    }
  }

  openHeroPicker(rowKey) {
    if (!this.data) {
      return;
    }
    const overlay = getSelectionOverlay();
    const currentHeroId = this.config.rows[rowKey]?.heroId || null;
    const disallowed = ROW_KEYS.filter(key => key !== rowKey)
      .map(key => this.config.rows[key]?.heroId)
      .filter(Boolean);
    const items = this.data.heroes.filter(hero => {
      if (!hero?.id) {
        return false;
      }
      if (hero.id === currentHeroId) {
        return true;
      }
      return !disallowed.includes(hero.id);
    }).map(hero => ({
      id: hero.id,
      name: hero.name,
      image: hero.image,
      description: getHeroTalentSummary(hero)
    }));
    overlay.open({
      title: '英雄を選択',
      items,
      allowClear: Boolean(currentHeroId),
      onSelect: heroId => this.setHero(rowKey, heroId),
      onClear: () => this.clearHero(rowKey),
      emptyMessage: '選択できる英雄がありません。',
      databaseType: 'hero'
    });
  }

  openSkillPicker(rowKey, slotKey) {
    if (!this.data || !USER_SKILL_KEYS.includes(slotKey)) {
      return;
    }
    const overlay = getSelectionOverlay();
    const currentSkillId = this.config.rows[rowKey]?.userSkills?.[slotKey] || null;
    const usedIds = [];
    ROW_KEYS.forEach(row => {
      USER_SKILL_KEYS.forEach(key => {
        const id = this.config.rows[row]?.userSkills?.[key];
        if (id && (row !== rowKey || key !== slotKey)) {
          usedIds.push(id);
        }
      });
    });
    const items = this.data.selectableSkills.filter(skill => {
      if (!skill?.id) {
        return false;
      }
      if (skill.id === currentSkillId) {
        return true;
      }
      return !usedIds.includes(skill.id);
    }).map(skill => ({
      id: skill.id,
      name: skill.name,
      image: skill.image,
      description: skill.description
    }));
    overlay.open({
      title: 'スキルを選択',
      items,
      allowClear: Boolean(currentSkillId),
      onSelect: skillId => this.setUserSkill(rowKey, slotKey, skillId),
      onClear: () => this.clearUserSkill(rowKey, slotKey),
      emptyMessage: '選択できるスキルがありません。',
      databaseType: 'skill'
    });
  }

  setHero(rowKey, heroId) {
    const next = cloneConfig(this.config);
    if (!next.rows[rowKey]) {
      next.rows[rowKey] = createEmptyRowConfig();
    }
    next.rows[rowKey].heroId = heroId;
    this.persistConfig(next);
  }

  clearHero(rowKey) {
    const next = cloneConfig(this.config);
    if (!next.rows[rowKey]) {
      return;
    }
    next.rows[rowKey].heroId = null;
    this.persistConfig(next);
  }

  setUserSkill(rowKey, slotKey, skillId) {
    const next = cloneConfig(this.config);
    if (!next.rows[rowKey]) {
      next.rows[rowKey] = createEmptyRowConfig();
    }
    next.rows[rowKey].userSkills[slotKey] = skillId;
    this.persistConfig(next);
  }

  clearUserSkill(rowKey, slotKey) {
    const next = cloneConfig(this.config);
    if (!next.rows[rowKey]) {
      return;
    }
    next.rows[rowKey].userSkills[slotKey] = null;
    this.persistConfig(next);
  }

  persistConfig(nextConfig) {
    const serialized = encodeHeroSkillsetConfig(nextConfig);
    if (serialized === this.serializedConfig) {
      return;
    }
    this.config = nextConfig;
    this.serializedConfig = serialized;
    this.render();
    const pos = typeof this.getPos === 'function' ? this.getPos() : null;
    if (typeof pos !== 'number') {
      return;
    }
    const { state, dispatch } = this.editor.view;
    const transaction = state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      configuration: serialized
    });
    dispatch(transaction);
  }

  render() {
    this.dom.setAttribute('data-config', this.serializedConfig);
    if (!this.data) {
      this.body.innerHTML = '<div class="hero-skillset-card__status">英雄・スキルデータを読み込み中...</div>';
      return;
    }
    this.body.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'hero-skillset-card__grid';
    ROW_KEYS.forEach(rowKey => {
      const heroId = this.config.rows[rowKey]?.heroId || null;
      const hero = heroId ? this.data.heroMap.get(heroId) : null;
      const fixedSkills = hero?.fixedSkillIds || [];
      const fixedSkillMeta = Array.isArray(hero?.fixedSkills) ? hero.fixedSkills : [];
      const resolveFixedSkill = (index) => {
        const skillId = fixedSkills[index] || null;
        const fallback = fixedSkillMeta[index] || null;
        const baseSkill = skillId ? this.data.skillMap.get(skillId) : null;
        if (baseSkill) {
          const mergedImage = baseSkill.image || fallback?.image || '';
          return mergedImage ? { ...baseSkill, image: mergedImage } : baseSkill;
        }
        if (fallback && (fallback.name || fallback.image || fallback.id)) {
          return { ...fallback };
        }
        return null;
      };
      const fixed1 = resolveFixedSkill(0);
      const fixed2 = resolveFixedSkill(1);
      const fixed5 = resolveFixedSkill(2);
      const userSkill3Id = this.config.rows[rowKey]?.userSkills?.skill3 || null;
      const userSkill4Id = this.config.rows[rowKey]?.userSkills?.skill4 || null;
      const userSkill3 = userSkill3Id ? this.data.skillMap.get(userSkill3Id) : null;
      const userSkill4 = userSkill4Id ? this.data.skillMap.get(userSkill4Id) : null;
      const row = document.createElement('div');
      row.className = 'hero-skillset-card__row';
      row.dataset.row = rowKey;
      const content = document.createElement('div');
      content.className = 'hero-skillset-card__row-content';
      const heroSlot = createHeroSlotButton(rowKey, hero);
      heroSlot.dataset.heroSlot = 'true';
      content.appendChild(heroSlot);
      const skills = document.createElement('div');
      skills.className = 'hero-skillset-card__skills';
      const skill1 = createSkillSlotElement({ rowKey, slotKey: 'skill1', skill: fixed1, editable: false });
      skill1.dataset.heroSlot = 'fixed';
      const skill2 = createSkillSlotElement({ rowKey, slotKey: 'skill2', skill: fixed2, editable: false });
      skill2.dataset.heroSlot = 'fixed';
      const skill3 = createSkillSlotElement({ rowKey, slotKey: 'skill3', skill: userSkill3, editable: true });
      skill3.dataset.skillSlot = 'skill3';
      const skill4 = createSkillSlotElement({ rowKey, slotKey: 'skill4', skill: userSkill4, editable: true });
      skill4.dataset.skillSlot = 'skill4';
      const skill5 = createSkillSlotElement({ rowKey, slotKey: 'skill5', skill: fixed5, editable: false });
      skill5.dataset.heroSlot = 'fixed';
      skills.append(skill1, skill2, skill3, skill4, skill5);
      content.appendChild(skills);
      row.appendChild(content);
      grid.appendChild(row);
    });
    this.body.appendChild(grid);
  }

  update(node) {
    if (node.type !== this.node.type) {
      return false;
    }
    this.node = node;
    const nextConfig = cloneConfig(node.attrs.configuration);
    const serialized = encodeHeroSkillsetConfig(nextConfig);
    if (serialized !== this.serializedConfig) {
      this.config = nextConfig;
      this.serializedConfig = serialized;
      this.render();
    }
    return true;
  }

  destroy() {
    this.dom.removeEventListener('click', this.handleClick);
  }
}

export const HeroSkillsetCard = Node.create({
  name: 'heroSkillsetCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,
  addAttributes() {
    return {
      configuration: {
        default: encodeHeroSkillsetConfig(getDefaultHeroSkillsetConfig())
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-hero-skillset-card]',
        priority: 1000,
        getAttrs: dom => {
          if (!(dom instanceof HTMLElement)) {
            return false;
          }
          const config = dom.getAttribute('data-config') || null;
          return { configuration: config };
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = {
      class: 'hero-skillset-card hero-skillset-card--view',
      'data-hero-skillset-card': '',
      'data-config': HTMLAttributes.configuration
        ? encodeHeroSkillsetConfig(HTMLAttributes.configuration)
        : encodeHeroSkillsetConfig(getDefaultHeroSkillsetConfig())
    };
    return ['div', attrs, ['div', { class: 'hero-skillset-card__placeholder' }, '英雄スキル構成カード']];
  },
  addCommands() {
    return {
      insertHeroSkillsetCard: () => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: {
            configuration: encodeHeroSkillsetConfig(getDefaultHeroSkillsetConfig())
          }
        });
      }
    };
  },
  addNodeView() {
    return ({ node, editor, getPos }) => new HeroSkillsetCardNodeView(node, editor, getPos);
  }
});
