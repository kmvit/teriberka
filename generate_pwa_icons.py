#!/usr/bin/env python3
"""
Генерирует PNG-иконки для PWA из одного исходного PNG (Pillow).
Использование: python generate_pwa_icons.py <путь_к_исходному_png>
"""
import sys
from pathlib import Path

from PIL import Image

# Куда класть иконки
PUBLIC_DIR = Path(__file__).resolve().parent / "frontend" / "public"

SIZES = [
    ("apple-touch-icon-180x180.png", 180),
    ("pwa-192x192.png", 192),
    ("pwa-512x512.png", 512),
    ("pwa-maskable-512x512.png", 512),
]


def main():
    if len(sys.argv) < 2:
        print("Использование: python generate_pwa_icons.py <путь_к_png>")
        sys.exit(1)
    src_path = Path(sys.argv[1])
    if not src_path.exists():
        print(f"Файл не найден: {src_path}")
        sys.exit(1)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    img = Image.open(src_path).convert("RGBA")
    for name, size in SIZES:
        out = img.resize((size, size), Image.Resampling.LANCZOS)
        out.save(PUBLIC_DIR / name, "PNG")
        print(f"Записано: {name}")
    print("Готово.")


if __name__ == "__main__":
    main()
