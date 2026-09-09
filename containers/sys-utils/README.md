# sys-utils

Тулбокс-образ с системными утилитами.

## Схема Homebrew

Homebrew **не входит в образ**. Он живёт **на хосте** в
`/var/home/linuxbrew`. Внутри toolbox этот путь контейнерно-локальный,
поэтому в образ добавлен симлинк
`/var/home/linuxbrew -> /run/host/var/home/linuxbrew`, перенаправляющий
его на реальную файловую систему хоста. Установленный brew переживает
пересоздание контейнера, а программы им установленные доступны и на хосте.

Правило: `brew install/upgrade` — только внутри toolbox; на хосте — только
запуск установленных программ.

## Первичная настройка (на хосте)

Каталог должен существовать до первого `brew install`, владелец — ваш
пользователь:

```bash
sudo mkdir -p /var/home/linuxbrew
sudo chown $USER:$USER /var/home/linuxbrew
```

## Установка Homebrew (внутри toolbox)

```bash
toolbox enter sys-utils
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

В `~/.bashrc` должен быть блок (при отсутствии — добавить, работает и на
хосте, и в контейнере):

```bash
if [ -d /home/linuxbrew/.linuxbrew/bin ]; then
    eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi
```

## После пересоздания контейнера

Симлинк уже в образе. Достаточно, чтобы каталог на хосте существовал
(см. «Первичная настройка»). Если Homebrew уже установлен — больше ничего
не требуется; если нет — выполнить установку из предыдущего раздела.
