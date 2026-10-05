import type { FileMap } from '../content/course';

const KEY = 'pixi-course:v1';

interface StepProgress {
  /** Текущий код ученика */
  code?: FileMap;
  /** Код ученика до нажатия «Решение» — чтобы его можно было вернуть */
  backup?: FileMap;
  done?: boolean;
}

interface Progress {
  steps: Record<string, StepProgress>;
  lastStep?: string;
  autorun?: boolean;
  /** Свёрнутые панели рабочей области: lesson, code, result */
  collapsed?: string[];
}

// localStorage может быть недоступен (приватный режим, запрет сайта) — тогда работаем без сохранения
function read(): Progress {
  try {
    const text = localStorage.getItem(KEY);
    if (text) return JSON.parse(text) as Progress;
  } catch {
    // ignore
  }
  return { steps: {} };
}

let state = read();

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function updateStep(stepId: string, patch: Partial<StepProgress>) {
  state.steps[stepId] = { ...state.steps[stepId], ...patch };
  write();
}

export const progress = {
  getCode: (stepId: string) => state.steps[stepId]?.code,
  setCode: (stepId: string, code: FileMap) => updateStep(stepId, { code }),
  clearCode: (stepId: string) => updateStep(stepId, { code: undefined, backup: undefined }),

  getBackup: (stepId: string) => state.steps[stepId]?.backup,
  setBackup: (stepId: string, backup: FileMap | undefined) => updateStep(stepId, { backup }),

  isDone: (stepId: string) => Boolean(state.steps[stepId]?.done),
  setDone: (stepId: string) => updateStep(stepId, { done: true }),

  getLastStep: () => state.lastStep,
  setLastStep: (stepId: string) => {
    state.lastStep = stepId;
    write();
  },

  getAutorun: () => state.autorun ?? true,
  setAutorun: (value: boolean) => {
    state.autorun = value;
    write();
  },

  getCollapsed: () => state.collapsed ?? [],
  setCollapsed: (value: string[]) => {
    state.collapsed = value;
    write();
  },

  /** Для отладки: полный сброс прогресса */
  resetAll: () => {
    state = { steps: {} };
    write();
  },
};
