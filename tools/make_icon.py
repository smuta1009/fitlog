"""Рисует иконку приложения (гантель на синем фоне).

- assets/fitlog.ico — для Windows (скруглённый квадрат с прозрачными углами);
- web/icons/*.png — для iPhone и браузеров (квадрат во весь размер: углы скругляет система).
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BLUE = "#4F46E5"
WHITE = "#FFFFFF"


def dumbbell(d: ImageDraw.ImageDraw, size: int, scale: float = 1.0) -> None:
    """Гантель, нарисованная в координатах 256×256 и отмасштабированная под size."""
    k = size / 256 * scale
    off = size / 2 - 128 * k

    def box(x0, y0, x1, y1):
        return (off + x0 * k, off + y0 * k, off + x1 * k, off + y1 * k)

    d.rounded_rectangle(box(60, 120, 196, 136), radius=6 * k, fill=WHITE)  # гриф
    for x0, x1, h in ((44, 70, 112), (70, 88, 76), (168, 186, 76), (186, 212, 112)):
        d.rounded_rectangle(box(x0, 128 - h // 2, x1, 128 + h // 2), radius=8 * k, fill=WHITE)  # блины


def windows_icon() -> None:
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((8, 8, 248, 248), radius=56, fill=BLUE)
    dumbbell(d, 256)
    out = ROOT / "assets" / "fitlog.ico"
    out.parent.mkdir(exist_ok=True)
    img.save(out, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"Иконка сохранена: {out}")


def web_icons() -> None:
    out_dir = ROOT / "web" / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, size in (("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)):
        big = size * 4  # рисуем крупно и уменьшаем — так края получаются гладкими
        img = Image.new("RGB", (big, big), BLUE)
        dumbbell(ImageDraw.Draw(img), big, scale=0.82)  # запас по краям для «maskable»-иконок
        img.resize((size, size), Image.LANCZOS).save(out_dir / name)
        print(f"Иконка сохранена: {out_dir / name}")


if __name__ == "__main__":
    windows_icon()
    web_icons()
