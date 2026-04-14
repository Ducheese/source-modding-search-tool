import { useReducer, useCallback } from 'react';

const initialState = {
  searchQuery: '',
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  includePattern: '',
  excludePattern: '',
  moreContext: false,
  contextLines: 4,
  aiRegex: false,
};

/**
 * 搜索表单状态 Reducer
 * 处理字段更新和互斥逻辑（useRegex <-> wholeWord）
 */
function searchReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': {
      const { field, value } = action;

      // AI 正则模式开启时，同时开启正则，关闭其他选项
      if (field === 'aiRegex' && value === true) {
        return { ...state, aiRegex: true, useRegex: true, wholeWord: false, caseSensitive: false };
      }

      // AI 正则模式关闭时，同时关闭正则
      if (field === 'aiRegex' && value === false) {
        return { ...state, aiRegex: false, useRegex: false };
      }

      // 正则开启时，关闭整词匹配（互斥）
      if (field === 'useRegex' && value === true) {
        return { ...state, useRegex: true, wholeWord: false };
      }

      // 整词开启时，关闭正则（互斥）
      if (field === 'wholeWord' && value === true) {
        return { ...state, wholeWord: true, useRegex: false };
      }

      return { ...state, [field]: value };
    }

    case 'SET_REGEX_SNIPPET':
      // 插入正则片段，同时开启正则模式
      return { 
        ...state, 
        searchQuery: state.searchQuery + action.value, 
        useRegex: true, 
        wholeWord: false 
      };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}

/**
 * 搜索表单状态管理 Hook
 * @returns {{ state: object, setField: function, insertSnippet: function, reset: function }}
 */
export function useSearchForm() {
  const [state, dispatch] = useReducer(searchReducer, initialState);

  const setField = useCallback((field, value) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const insertSnippet = useCallback((value) => {
    dispatch({ type: 'SET_REGEX_SNIPPET', value });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, setField, insertSnippet, reset };
}
