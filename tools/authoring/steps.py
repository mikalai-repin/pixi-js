# Запись кода шагов главы на диск — общая для генераторов глав (Python-скрипты, см. docs/authoring-process.md).
# Скрипт из временной папки подключает её так:
#   import sys; sys.path.insert(0, '<путь к проекту>/tools/authoring'); from steps import write_steps, step_files
#
# steps = {'01-slug': {'start': {...}, 'solution': {...}}, ...} — в порядке шагов. Значение 'start'/'solution' —
# ПОЛНЫЙ набор файлов шага: словарь «путь файла → код» или строка — путь папки с полным набором.
# 'start' можно не указывать: тогда старт — результат предыдущего шага. 'solution' не указывают у шагов без решения.
#
# На диск write_steps пишет только отличия (так их читают платформа, валидатор и tools/e2e — scripts/step-files.mjs):
#   start/    — файлы старта, которые отличаются от результата предыдущего шага (у первого шага главы —
#               от результата последнего шага прошлой главы);
#   solution/ — файлы решения, которые отличаются от старта.
# Если старт отличается от результата предыдущего шага, во frontmatter шага нужен startFrom: custom, а файлы,
# которые из старта убраны, перечисляются в remove: [...]. write_steps возвращает и печатает, что нужно
# во frontmatter каждого шага, и сверяет это с уже написанным lesson.md; расхождения покажет и npm run validate.
import json, os, re, shutil, subprocess

PROJECT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))


def step_files(path):
    """Полный набор файлов шага (словарь «путь → код») по пути …/<шаг>/start, …/<шаг>/solution или …/<шаг>/result.

    Путь к папке главы — база её первого шага: результат последнего шага прошлых глав.
    Генераторы читают так код прошлой главы: CH12 = step_files(f'{PROJECT}/content/12-effects/09-practice/result').
    """
    out = subprocess.run(['node', os.path.join(PROJECT, 'scripts', 'step-files.mjs'), path],
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def _read_dir(path):
    files = {}
    for current, _, names in os.walk(path):
        for name in names:
            full = os.path.join(current, name)
            with open(full) as f:
                files[os.path.relpath(full, path)] = f.read()
    return files


def _full(files):
    return _read_dir(files) if isinstance(files, str) else files


def _diff(base, files):
    return {name: code for name, code in files.items() if base.get(name) != code}


def _frontmatter(lesson_path):
    if not os.path.exists(lesson_path):
        return None
    with open(lesson_path) as f:
        match = re.match(r'---\r?\n(.*?)\r?\n---', f.read(), re.S)
    if not match:
        return None
    meta = {}
    for line in match.group(1).splitlines():
        key, _, value = line.partition(':')
        meta[key.strip()] = value.strip()
    return meta


def write_steps(root, steps, base=None):
    """Записывает отличия шагов главы root. base — результат предыдущего шага курса (по умолчанию — читается с диска)."""
    previous = step_files(root) if base is None else _full(base)
    needed = {}
    for step, spec in steps.items():
        start = _full(spec['start']) if spec.get('start') is not None else dict(previous)
        solution = _full(spec['solution']) if spec.get('solution') is not None else None
        stepdir = os.path.join(root, step)
        os.makedirs(stepdir, exist_ok=True)

        remove = sorted(name for name in previous if name not in start)
        own = {'start': _diff(previous, start), 'solution': _diff(start, solution) if solution is not None else {}}
        if solution is not None and not own['solution']:
            raise ValueError(f'{step}: решение совпадает со стартом — кнопке «Решение» нечего показать')
        missing = [name for name in start if solution is not None and name not in solution]
        if missing:
            raise ValueError(f'{step}: решение не может удалять файлы ({", ".join(missing)}) — уберите их в старте следующего шага')

        for kind, files in own.items():
            path = os.path.join(stepdir, kind)
            if os.path.isdir(path):
                shutil.rmtree(path)
            for name, code in files.items():
                full = os.path.join(path, name)
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, 'w') as f:
                    f.write(code)

        custom = bool(own['start'] or remove)
        needed[step] = {'startFrom': 'custom' if custom else 'previous', 'remove': remove}
        meta = _frontmatter(os.path.join(stepdir, 'lesson.md'))
        if meta is not None:
            has = meta.get('startFrom', 'previous')
            has_remove = sorted(n.strip() for n in meta.get('remove', '').strip('[]').split(',') if n.strip())
            if has != needed[step]['startFrom'] or has_remove != remove:
                print(f'!! {step}: во frontmatter нужно startFrom: {needed[step]["startFrom"]}'
                      + (f', remove: [{", ".join(remove)}]' if remove else ', без remove'))
        elif custom:
            print(f'{step}: во frontmatter нужно startFrom: custom' + (f', remove: [{", ".join(remove)}]' if remove else ''))
        previous = solution if solution is not None else start
    return needed
