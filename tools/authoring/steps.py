# Запись кода шагов главы на диск — общая для генераторов глав (Python-скрипты, см. docs/authoring-process.md).
# Скрипт из временной папки подключает её так:
#   import sys; sys.path.insert(0, '<путь к проекту>/tools/authoring'); from steps import write_steps, step_dir
#
# steps = {'01-slug': {'start': {...}, 'solution': {...}}, ...} — в порядке шагов. Значение 'start'/'solution' —
# словарь «путь файла → код» или строка: путь папки, которую нужно скопировать целиком.
#
# Папку start/ шага, совпадающую с результатом предыдущего шага (его solution, а у шага без решения — start),
# write_steps НЕ записывает: такой шаг — startFrom: previous, и платформа, валидатор и tools/e2e берут его старт
# из предыдущего шага (src/content/course.ts, scripts/step-files.mjs). Так в content/ нет копий одних и тех же файлов.
# Если start/ шага отличается от результата предыдущего, во frontmatter шага нужен startFrom: custom —
# это проверит npm run validate.
import os, shutil


def write_steps(root, steps):
    previous = None
    for step, spec in steps.items():
        start = spec.get('start')
        solution = spec.get('solution')
        stepdir = os.path.join(root, step)
        os.makedirs(stepdir, exist_ok=True)
        own = {'start': None if start == previous else start, 'solution': solution}
        for kind, files in own.items():
            path = os.path.join(stepdir, kind)
            if os.path.isdir(path):
                shutil.rmtree(path)
            if files is None:
                continue
            if isinstance(files, str):
                shutil.copytree(files, path)
                continue
            for name, code in files.items():
                full = os.path.join(path, name)
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, 'w') as f:
                    f.write(code)
        previous = solution if solution is not None else start


def step_dir(path):
    """Папка с файлами шага по пути …/<шаг>/start или …/<шаг>/solution.

    У шага со startFrom: previous папки start/ нет — возвращается папка, откуда берётся его старт:
    solution/ предыдущего шага (у шага без решения — его start/, тоже по цепочке).
    Генераторы читают через неё код прошлой главы: CH04 = step_dir(f'{PROJECT}/content/…/start').
    """
    if os.path.isdir(path):
        return path
    stepdir, kind = os.path.split(path)
    if kind != 'start':
        raise FileNotFoundError(path)
    chapter, step = os.path.split(stepdir)
    steps = sorted(d for d in os.listdir(chapter) if os.path.isdir(os.path.join(chapter, d)))
    index = steps.index(step)
    if index == 0:
        raise FileNotFoundError(path)
    previous = os.path.join(chapter, steps[index - 1])
    solution = os.path.join(previous, 'solution')
    return solution if os.path.isdir(solution) else step_dir(os.path.join(previous, 'start'))
