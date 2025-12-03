// extensions/editorInfo/EditorInfo.js
import { Extension } from 'https://esm.sh/@tiptap/core';

export const EditorInfo = Extension.create({
  name: 'editorInfo',

  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'bulletList',
          'orderedList',
          'listItem',
          'table',
          'tableRow',
          'tableCell',
          'pageLinkCard',
          'heroSkillsetCard'
        ],
        attributes: {
          editorUsername: {
            default: null,
            parseHTML: element => element.getAttribute('data-editor-username'),
            renderHTML: attrs =>
              attrs.editorUsername
                ? { 'data-editor-username': attrs.editorUsername }
                : {}
          },
          editorPlayerId: {
            default: null,
            parseHTML: element => element.getAttribute('data-editor-playerid'),
            renderHTML: attrs =>
              attrs.editorPlayerId
                ? { 'data-editor-playerid': attrs.editorPlayerId }
                : {}
          },
          editorUpdatedAt: {
            default: null,
            parseHTML: element => element.getAttribute('data-editor-updated-at'),
            renderHTML: attrs =>
              attrs.editorUpdatedAt
                ? { 'data-editor-updated-at': attrs.editorUpdatedAt }
                : {}
          }
        }
      }
    ];
  }
});
