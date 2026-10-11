# -*- coding: utf-8 -*-
"""Generates the menu, the category index, the category chip bar and the receipt hit-list in index.html.

Demo menu of the fictional cafe «Ланч» (portfolio build); prices are illustrative.
Run:  python tools/build_menu.py
"""
import re, io, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")

# (slug, title, image or None, items)
# item: (name, price | [(variant, price), ...], tags, hit)
MENU = [
    ("burger", "Бургер", None, [
        ("Бургер Smash", 560, ["двойная котлета"], True),
        ("Бургер с копчёным мясом", 620, [], False),
        ("Бургер с курицей", 420, [], False),
        ("Бургер с моцареллой", 510, ["брусничный соус"], False),
        ("Бургер Ланч", 320, ["фирменный"], True),
        ("Шаурма с курицей", 380, [], False),
        ("Такос с курицей", [("малый", 380), ("большой", 450)], [], True),
    ]),
    ("snacks", "Закуски", None, [
        ("Картошка фри", 170, [], False),
        ("Картофель по-деревенски", 240, [], False),
        ("Наггетсы", 240, ["6 шт"], False),
        ("Куриные крылышки", 430, [], True),
        ("Креветки", 390, [], True),
        ("Крокеты", 390, [], False),
    ]),
    ("sandwich", "Сэндвичи", None, [
        ("Сэндвич с курицей", 380, [], False),
        ("Сэндвич с говядиной", 420, [], False),
    ]),
    ("food-extra", "Допы к еде", None, [
        ("Халапеньо", 50, [], False),
        ("Соусы", 80, [], False),
    ]),
    ("dessert", "Десерты", None, [
        ("Круассан", 380, [], False),
    ]),
    ("coffee", "Кофе", None, [
        ("Эспрессо", 190, [], False),
        ("Американо", 220, [], False),
        ("Флэт уайт", 240, ["0,2 л"], False),
        ("Капучино", [("0,2 л", 240), ("0,3 л", 270)], [], False),
        ("Латте", 270, [], False),
        ("Раф", [("0,2 л", 270), ("0,4 л", 310)], [], False),
        ("Фильтр-кофе", 240, ["0,2 л"], False),
    ]),
    ("ice-coffee", "Айс кофе", None, [
        ("Эспрессо тоник", 300, [], False),
        ("Бамбл апельсин", 300, [], False),
        ("Бамбл гранат", 300, [], False),
        ("Айс латте", 300, [], False),
        ("Айс урбеч", 380, [], False),
    ]),
    ("warm", "То, что согревает", None, [
        ("Какао", 240, ["0,2 л"], False),
        ("Горячий шоколад", 270, ["0,2 л"], False),
    ]),
    ("tea", "Чаи", None, [
        ("Чай листовой", [("0,2 л", 110), ("0,4 л", 240)], [], False),
        ("Облепиха-апельсин", 270, [], False),
        ("Ягодный чай", 270, [], False),
        ("Имбирь-лимон", 270, [], False),
    ]),
    ("lemonade", "Лимонады", None, [
        ("Манго-маракуйя", 320, [], False),
        ("Вишня-гранат", 320, [], False),
        ("Ягодный лимонад", 320, [], False),
        ("Мохито классический", 320, [], False),
        ("Мохито клубника", 320, [], False),
        ("Колд брю", 380, [], False),
    ]),
    ("shakes", "Милкшейки", None, [
        ("Орео", 310, [], False),
        ("Шоколадный", 310, [], False),
        ("Клубничный", 310, [], False),
        ("Банановый", 310, [], False),
    ]),
    ("drink-extra", "Допы к напиткам", None, [
        ("Сироп", 40, [], False),
        ("Маршмэллоу", 50, [], False),
        ("Безлактозное молоко", 80, [], False),
    ]),
    ("drinks", "Напитки", None, [
        ("Вода без газа / с газом", 90, [], False),
        ("Кока-кола", 140, [], False),
    ]),
]

IMG_SIZE = {}
IMG_ALT = {}

def esc(s):
    return html.escape(s, quote=True)

def fmt(n):
    return f"{n:,}".replace(",", " ")

def add_label(name, variant=None, price=None):
    if variant:
        return f"Добавить {name} ({variant}) за {price} ₽ в чек"
    return f"Добавить {name} в чек"

def item_html(name, price, tags, hit):
    tag_html = ""
    tags_all = (["хит"] if hit else []) + list(tags)
    if tags_all:
        tag_html = '<span class="item__tags">' + "".join(
            f'<span class="tag{" tag--hit" if t == "хит" else ""}">{esc(t)}</span>' for t in tags_all
        ) + "</span>"
    if isinstance(price, list):
        buttons = "".join(
            f'<button class="add add--variant" type="button" data-add data-variant="{esc(v)}" data-price="{p}" '
            f'aria-label="{esc(add_label(name, v, p))}"><span>{esc(v)}</span><b>{fmt(p)}</b></button>'
            for v, p in price
        )
        return (
            f'<li class="item item--variants" data-name="{esc(name)}">'
            f'<div class="item__main"><span class="item__name">{esc(name)}{tag_html}</span></div>'
            f'<div class="item__variants">{buttons}</div>'
            f"</li>"
        )
    return (
        f'<li class="item" data-name="{esc(name)}" data-price="{price}">'
        f'<div class="item__main"><span class="item__name">{esc(name)}{tag_html}</span>'
        f'<span class="item__end"><span class="item__leader" aria-hidden="true"></span><span class="item__price">{fmt(price)}</span></span></div>'
        f'<button class="add" type="button" data-add aria-label="{esc(add_label(name))}">'
        f'<svg class="ico" width="18" height="18"><use href="#i-plus"/></svg></button>'
        f"</li>"
    )

def build_menu():
    out = []
    for slug, title, img, items in MENU:
        out.append(f'<section class="cat" id="cat-{slug}" aria-labelledby="cat-{slug}-title">')
        out.append(f'  <header class="cat__head"><h3 class="cat__title" id="cat-{slug}-title">{esc(title)}</h3>'
                   f'<span class="cat__count">{len(items)}</span></header>')
        if img:
            w, h = IMG_SIZE[img]
            out.append(f'  <img class="cat__print" src="img/{img}" alt="{esc(IMG_ALT[img])}" loading="lazy" width="{w}" height="{h}">')
        out.append('  <ul class="items">')
        for name, price, tags, hit in items:
            out.append("    " + item_html(name, price, tags, hit))
        out.append("  </ul>")
        out.append("</section>")
    return "\n".join(out)

def build_index():
    return "\n".join(
        f'<li class="contents__row"><a class="contents__link" href="#cat-{slug}"><span class="contents__name">{esc(title)}</span>'
        f'<span class="line__leader" aria-hidden="true"></span><span class="contents__n">{len(items)}</span></a></li>'
        for slug, title, img, items in MENU
    )

def build_catbar():
    """Chips of the sticky category bar under the top bar (mobile "шапочка")."""
    return "\n".join(
        f'<li><a class="catbar__chip" href="#cat-{slug}">{esc(title)}</a></li>'
        for slug, title, img, items in MENU
    )

def build_hits():
    out = []
    for slug, title, img, items in MENU:
        for name, price, tags, hit in items:
            if not hit:
                continue
            if isinstance(price, list):
                buttons = "".join(
                    f'<button class="add add--variant add--sm" type="button" data-add data-variant="{esc(v)}" data-price="{p}" '
                    f'aria-label="{esc(add_label(name, v, p))}"><span>{esc(v)}</span><b>{fmt(p)}</b></button>'
                    for v, p in price
                )
                out.append(f'<li class="line line--suggest line--variants" data-name="{esc(name)}">'
                           f'<span class="line__name">{esc(name)}</span><span class="line__variants">{buttons}</span></li>')
            else:
                out.append(f'<li class="line line--suggest" data-name="{esc(name)}" data-price="{price}">'
                           f'<span class="line__name">{esc(name)}</span><span class="line__leader" aria-hidden="true"></span>'
                           f'<span class="line__price">{fmt(price)}</span>'
                           f'<button class="add add--sm" type="button" data-add aria-label="{esc(add_label(name))}">'
                           f'<svg class="ico" width="16" height="16"><use href="#i-plus"/></svg></button></li>')
    return "\n".join(out)

def inject(src, marker, body):
    start, end = f"<!-- {marker}:START -->", f"<!-- {marker}:END -->"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pattern.search(src):
        raise SystemExit(f"marker {marker} not found")
    return pattern.sub(lambda m: f"{start}\n{body}\n{end}", src)

def main():
    src = io.open(INDEX, encoding="utf-8").read()
    src = inject(src, "MENU", build_menu())
    src = inject(src, "INDEX", build_index())
    src = inject(src, "CATBAR", build_catbar())
    src = inject(src, "HITS", build_hits())
    io.open(INDEX, "w", encoding="utf-8", newline="\n").write(src)
    n = sum(len(items) for *_, items in MENU)
    print(f"menu: {len(MENU)} categories, {n} items written")

if __name__ == "__main__":
    main()
