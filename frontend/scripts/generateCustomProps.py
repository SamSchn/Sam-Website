"""Generate custom pixel-art props that the Cute Fantasy pack doesn't include
(bulletin board, TV, mailbox, portrait, fireplace, rugs, papers, UI frame).

Colours are taken from the pack's own palette so the props blend in.
Requires Pillow:  python3 scripts/generateCustomProps.py
Writes PNGs to public/sprites/custom/ and public/ui/.
"""
import os
import random
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
OUT = os.path.join(ROOT, 'sprites', 'custom')
UI = os.path.join(ROOT, 'ui')
os.makedirs(OUT, exist_ok=True)
os.makedirs(UI, exist_ok=True)

def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

C = {k: hexc(v) for k, v in {
    'O': '3f2832',  # outline
    'W': 'bf6f4a',  # wood
    'D': '8a4836',  # wood dark
    'L': 'e69c69',  # wood light
    'd': '5d2c28',  # wood darkest
    'g': '424c6e',  # slate dark
    'b': '657392',  # slate
    'l': 'c7cfdd',  # light grey
    'G': '92a1b9',  # grey-blue
    'S': '1d2433',  # screen off
    's': '27405e',  # screen dim
    'c': '4aa3df',  # screen glow
    'C': 'a6e3ff',  # screen bright
    'R': 'c42430',  # red
    'r': '891e2b',  # dark red
    'K': 'c28d75',  # cork
    'k': 'a8705a',  # cork dark
    'P': 'f6ead6',  # paper
    'p': 'b8a58e',  # paper ink
    'Y': 'ffe08a',
    'B': 'bde0f6',
    'N': 'f5b8c4',
    'M': '24181a',  # soot
    'X': 'a5583e',  # brick
    'x': '743f39',  # brick dark
    'F': 'ffa214',  # fire
    'f': 'ffd541',
    'E': 'e04a2a',
    'H': '6b3b27',  # hair
    'T': 'f0b48a',  # skin
    'U': '3b6fb6',  # shirt
    'A': '8fd3ff',  # sky
    'V': '5ac54f',
    'v': '33984b',
    'Q': 'e7d3b8',  # fringe
}.items()}


def new(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def px(im, x, y, col):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), C[col] if isinstance(col, str) else col)


def rect(im, x0, y0, x1, y1, col):
    """Filled rect, inclusive coords."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(im, x, y, col)


def box(im, x0, y0, x1, y1, fill, outline='O'):
    rect(im, x0, y0, x1, y1, outline)
    rect(im, x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)


def save(im, name, folder=OUT):
    im.save(os.path.join(folder, name))
    print('wrote', name, im.size)


# ---------------------------------------------------------------- bulletin board
def bulletin_board():
    im = new(32, 26)
    box(im, 0, 0, 31, 23, 'D')
    rect(im, 1, 1, 30, 1, 'L')          # top highlight
    rect(im, 1, 22, 30, 22, 'd')        # bottom shade
    rng = random.Random(7)
    for y in range(3, 21):
        for x in range(3, 29):
            px(im, x, y, 'k' if rng.random() < 0.18 else 'K')
    rect(im, 2, 2, 29, 2, 'd')          # inner frame shadow
    papers = [(4, 4, 12, 13, 'P', 'R'), (14, 3, 21, 10, 'Y', 'U'),
              (22, 5, 28, 14, 'B', 'R'), (13, 12, 21, 20, 'N', 'v'),
              (5, 15, 11, 20, 'P', 'U')]
    for x0, y0, x1, y1, col, pin in papers:
        rect(im, x0 + 1, y0 + 1, x1 + 1, y1 + 1, 'k')   # drop shadow
        rect(im, x0, y0, x1, y1, col)
        for ly in range(y0 + 3, y1, 2):
            rect(im, x0 + 1, ly, x1 - 2 - (ly % 3), ly, 'p')
        px(im, (x0 + x1) // 2, y0, pin)
        px(im, (x0 + x1) // 2, y0 + 1, 'O')
    # little mounting legs hidden behind; give the board a soft wall shadow
    rect(im, 1, 24, 31, 24, (0, 0, 0, 60))
    save(im, 'bulletin_board.png')


# ---------------------------------------------------------------- TV (2 frames)
def tv():
    frames = []
    for f in range(3):
        im = new(24, 26)
        # antenna
        for i in range(5):
            px(im, 9 - i, 4 - i, 'O')
            px(im, 14 + i, 4 - i, 'O')
        px(im, 4, 0, 'l'); px(im, 19, 0, 'l')
        # body
        box(im, 1, 4, 22, 18, 'b')
        rect(im, 2, 5, 21, 5, 'G')
        rect(im, 2, 17, 21, 17, 'g')
        # screen
        box(im, 3, 7, 15, 16, 'S')
        if f == 0:
            px(im, 5, 9, 's'); px(im, 6, 9, 's'); px(im, 5, 10, 's')
        else:
            for y in range(8, 16):
                for x in range(4, 15):
                    on = (y + f) % 2 == 0
                    px(im, x, y, 'c' if on else 's')
            rect(im, 5, 9, 9, 9, 'C')
            rect(im, 5, 11, 12, 11, 'C' if f == 1 else 'c')
            rect(im, 5, 13, 8, 13, 'C')
        # knobs + speaker grille
        box(im, 17, 7, 20, 10, 'l')
        px(im, 18, 8, 'g')
        for y in range(12, 16, 2):
            rect(im, 17, y, 20, y, 'g')
        # wooden stand
        box(im, 0, 18, 23, 23, 'W')
        rect(im, 1, 19, 22, 19, 'L')
        rect(im, 2, 21, 21, 21, 'D')
        px(im, 2, 24, 'O'); px(im, 2, 25, 'O'); px(im, 21, 24, 'O'); px(im, 21, 25, 'O')
        px(im, 3, 24, 'D'); px(im, 20, 24, 'D')
        frames.append(im)
    strip = new(24 * len(frames), 26)
    for i, im in enumerate(frames):
        strip.paste(im, (i * 24, 0))
    save(strip, 'tv_anim.png')


# ---------------------------------------------------------------- mailbox
def mailbox():
    im = new(16, 24)
    # post
    box(im, 6, 11, 9, 23, 'W')
    rect(im, 7, 12, 7, 22, 'L')
    rect(im, 5, 23, 10, 23, 'O')
    # box (rounded top)
    rect(im, 2, 3, 13, 12, 'O')
    rect(im, 3, 2, 12, 2, 'O')
    rect(im, 3, 3, 12, 11, 'b')
    rect(im, 4, 3, 11, 3, 'G')
    rect(im, 3, 4, 12, 4, 'G')
    rect(im, 3, 11, 12, 11, 'g')
    # door with letter slot
    box(im, 4, 6, 8, 10, 'g')
    rect(im, 5, 8, 7, 8, 'l')
    # flag (raised)
    rect(im, 13, 4, 13, 10, 'O')
    box(im, 13, 1, 16, 5, 'R')
    px(im, 14, 2, 'E')
    save(im, 'mailbox.png')


# ---------------------------------------------------------------- portrait
def portrait():
    im = new(16, 18)
    box(im, 0, 0, 15, 15, 'W')
    rect(im, 1, 1, 14, 1, 'L')
    rect(im, 1, 14, 14, 14, 'D')
    rect(im, 2, 2, 13, 13, 'A')
    rect(im, 2, 11, 13, 13, 'V')      # grass hill
    rect(im, 2, 12, 13, 13, 'v')
    # tiny Sam: hair, face, shirt
    rect(im, 6, 4, 10, 5, 'H')
    rect(im, 5, 5, 5, 7, 'H')
    rect(im, 6, 6, 10, 8, 'T')
    px(im, 7, 7, 'O')
    px(im, 9, 7, 'O')
    rect(im, 5, 9, 11, 12, 'U')
    rect(im, 7, 9, 9, 9, 'T')
    rect(im, 1, 16, 15, 16, (0, 0, 0, 55))
    save(im, 'portrait.png')


# ---------------------------------------------------------------- fireplace (3 frames)
def fireplace():
    W_, H_ = 32, 48
    frames = []
    for f in range(3):
        im = new(W_, H_)
        # chimney breast
        rect(im, 6, 0, 25, 20, 'O')
        rect(im, 7, 0, 24, 20, 'X')
        # body
        rect(im, 1, 18, 30, 47, 'O')
        rect(im, 2, 19, 29, 46, 'X')
        # brick courses
        for y in range(1, 46, 4):
            x0, x1 = (7, 24) if y < 19 else (2, 29)
            rect(im, x0, y, x1, y, 'x')
            off = 0 if (y // 4) % 2 == 0 else 4
            for x in range(x0 + off, x1, 8):
                rect(im, x, y + 1, x, min(y + 3, 46), 'x')
        # mantel
        box(im, 0, 22, 31, 25, 'W')
        rect(im, 1, 23, 30, 23, 'L')
        # opening
        rect(im, 7, 30, 24, 44, 'O')
        rect(im, 8, 31, 23, 44, 'M')
        rect(im, 9, 31, 22, 32, 'O')
        # logs
        rect(im, 10, 41, 21, 43, 'D')
        rect(im, 10, 41, 21, 41, 'W')
        # fire
        flames = [
            [(11, 40, 33), (14, 40, 35), (17, 40, 34), (20, 40, 36)],
            [(11, 40, 35), (14, 40, 33), (17, 40, 36), (20, 40, 34)],
            [(11, 40, 34), (14, 40, 36), (17, 40, 33), (20, 40, 35)],
        ][f]
        for fx, base, top in flames:
            for y in range(top, base + 1):
                width = 1 if y < top + 2 else 2
                col = 'f' if y > base - 3 else ('F' if y > top + 1 else 'E')
                rect(im, fx - width + 1, y, fx + width - 1, y, col)
        # hearth
        rect(im, 0, 45, 31, 47, 'O')
        rect(im, 1, 45, 30, 46, 'b')
        rect(im, 1, 45, 30, 45, 'G')
        frames.append(im)
    strip = new(W_ * 3, H_)
    for i, im in enumerate(frames):
        strip.paste(im, (i * W_, 0))
    save(strip, 'fireplace_anim.png')


# ---------------------------------------------------------------- rugs
def rug_big():
    im = new(48, 32)
    rect(im, 2, 1, 45, 30, 'O')
    rect(im, 3, 2, 44, 29, 'r')
    rect(im, 5, 4, 42, 27, 'R')
    rect(im, 7, 6, 40, 25, 'r')
    # diamond pattern
    cx, cy = 23, 15
    for y in range(7, 25):
        for x in range(8, 40):
            d = abs(x - cx) / 2 + abs(y - cy)
            if 5 <= d <= 6 or d <= 1.5:
                px(im, x, y, 'L')
            elif 9 <= d <= 9.8:
                px(im, x, y, 'F')
    # fringe
    for y in range(2, 30, 2):
        px(im, 0, y, 'Q'); px(im, 1, y, 'Q')
        px(im, 46, y, 'Q'); px(im, 47, y, 'Q')
    save(im, 'rug_big.png')


def doormat():
    im = new(32, 16)
    box(im, 0, 1, 31, 14, 'D')
    rect(im, 2, 3, 29, 12, 'W')
    for y in range(3, 13):
        for x in range(2, 30):
            if (x + y) % 4 == 0:
                px(im, x, y, 'D')
    rect(im, 2, 3, 29, 3, 'L')
    save(im, 'doormat.png')


# ---------------------------------------------------------------- papers (resume)
def papers():
    im = new(16, 14)
    box(im, 3, 3, 14, 12, 'p')
    rect(im, 4, 4, 13, 11, 'l')
    box(im, 1, 1, 12, 11, 'p')
    rect(im, 2, 2, 11, 10, 'P')
    for y in range(4, 10, 2):
        rect(im, 3, y, 10 - (y % 3), y, 'p')
    rect(im, 3, 3, 7, 3, 'O')
    # red ribbon seal
    rect(im, 9, 8, 11, 10, 'R')
    px(im, 10, 9, 'E')
    save(im, 'papers.png')


# ---------------------------------------------------------------- textured grass
def grass_tiles():
    """8 grass variants on the pack's flat grass colour, with a few blade marks.
    Variant 0 is plain so large areas don't look noisy."""
    base, dark, light = hexc('3e8948'), hexc('2f7343'), hexc('58a04f')
    im = new(16 * 8, 16)
    for v in range(8):
        rng = random.Random(100 + v)
        ox = v * 16
        rect(im, ox, 0, ox + 15, 15, base)
        if v == 0:
            continue
        for _ in range(2 + v % 3):
            x, y = rng.randrange(1, 14), rng.randrange(2, 15)
            # little "v" shaped blade
            px(im, ox + x, y, dark)
            px(im, ox + x + 2, y, dark)
            px(im, ox + x + 1, y + 1, dark)
            if rng.random() < 0.6:
                px(im, ox + x + 1, y - 1, light)
        for _ in range(v % 2 + 1):
            px(im, ox + rng.randrange(0, 16), rng.randrange(0, 16), light)
    save(im, 'grass_tiles.png')


# ---------------------------------------------------------------- UI icons (16x16)
ICON_NAMES = ['book', 'portrait', 'scroll', 'letter', 'tv', 'pin', 'gear', 'key',
              'sun', 'moon', 'leaf', 'flower', 'snow', 'code', 'briefcase', 'sprout']


def ui_icons():
    im = new(16 * len(ICON_NAMES), 16)

    def at(i):
        return i * 16

    # book
    o = at(0)
    rect(im, o + 3, 2, o + 13, 13, 'O')
    rect(im, o + 4, 3, o + 12, 12, 'R')
    rect(im, o + 4, 3, o + 5, 12, 'r')
    rect(im, o + 11, 4, o + 12, 12, 'P')
    rect(im, o + 7, 5, o + 10, 5, 'f')
    rect(im, o + 7, 7, o + 9, 7, 'f')
    rect(im, o + 3, 14, o + 13, 14, 'O')
    # portrait
    o = at(1)
    box(im, o + 1, 1, o + 14, 14, 'W')
    rect(im, o + 3, 3, o + 12, 12, 'A')
    rect(im, o + 3, 10, o + 12, 12, 'V')
    rect(im, o + 6, 4, o + 9, 5, 'H')
    rect(im, o + 6, 6, o + 9, 8, 'T')
    rect(im, o + 5, 9, o + 10, 12, 'U')
    # scroll
    o = at(2)
    rect(im, o + 3, 3, o + 12, 12, 'O')
    rect(im, o + 4, 3, o + 11, 12, 'P')
    for y in (5, 7, 9):
        rect(im, o + 5, y, o + 10, y, 'p')
    box(im, o + 2, 1, o + 13, 3, 'L')
    box(im, o + 2, 12, o + 13, 14, 'L')
    # letter
    o = at(3)
    box(im, o + 1, 3, o + 14, 12, 'P')
    for i in range(6):
        px(im, o + 2 + i, 4 + i, 'p')
        px(im, o + 13 - i, 4 + i, 'p')
    rect(im, o + 7, 8, o + 8, 10, 'R')
    # tv
    o = at(4)
    px(im, o + 5, 1, 'O'); px(im, o + 6, 2, 'O'); px(im, o + 10, 1, 'O'); px(im, o + 9, 2, 'O')
    box(im, o + 1, 3, o + 14, 13, 'b')
    rect(im, o + 3, 5, o + 10, 11, 'c')
    rect(im, o + 4, 6, o + 6, 6, 'C')
    rect(im, o + 12, 5, o + 12, 6, 'l')
    rect(im, o + 12, 8, o + 12, 11, 'g')
    # pin
    o = at(5)
    for y in range(2, 9):
        for x in range(4, 12):
            if (x - 7.5) ** 2 + (y - 5) ** 2 <= 12:
                px(im, o + x, y, 'R')
    px(im, o + 6, 3, 'N'); px(im, o + 6, 4, 'N')
    rect(im, o + 7, 9, o + 8, 14, 'l')
    # gear
    o = at(6)
    for (x0, y0) in [(6, 0), (6, 13), (0, 6), (13, 6), (2, 2), (11, 2), (2, 11), (11, 11)]:
        rect(im, o + x0, y0, o + x0 + (2 if x0 in (2, 11) else 3), y0 + (2 if y0 in (2, 11) else 2) if x0 in (2, 11) else y0 + (2 if x0 == 6 else 3), 'b')
    for y in range(16):
        for x in range(16):
            d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
            if d <= 5.2:
                px(im, o + x, y, 'G' if d > 2.4 else (0, 0, 0, 0))
            if 4.4 < d <= 5.2:
                px(im, o + x, y, 'b')
    # key
    o = at(7)
    for y in range(2, 9):
        for x in range(2, 9):
            d = (x - 5) ** 2 + (y - 5) ** 2
            if 4 <= d <= 10:
                px(im, o + x, y, 'f')
    rect(im, o + 8, 7, o + 14, 8, 'f')
    rect(im, o + 11, 9, o + 11, 10, 'f')
    rect(im, o + 13, 9, o + 13, 11, 'f')
    # sun
    o = at(8)
    for y in range(16):
        for x in range(16):
            d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
            if d <= 3.6:
                px(im, o + x, y, 'f')
            elif 5 <= d <= 7 and (abs(x - 7.5) < 1 or abs(y - 7.5) < 1 or abs(abs(x - 7.5) - abs(y - 7.5)) < 1):
                px(im, o + x, y, 'F')
    # moon
    o = at(9)
    for y in range(16):
        for x in range(16):
            if (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 30 and (x - 10.5) ** 2 + (y - 5.5) ** 2 > 22:
                px(im, o + x, y, 'Y')
    # leaf (fall)
    o = at(10)
    for y in range(2, 13):
        for x in range(2, 14):
            if abs(x - 7.5) + abs(y - 7) * 0.9 <= 5.5:
                px(im, o + x, y, 'F' if (x + y) % 5 else 'E')
    rect(im, o + 7, 12, o + 8, 14, 'D')
    # flower (spring)
    o = at(11)
    for cx, cy in [(7.5, 3.5), (3.5, 7), (11.5, 7), (5, 11.5), (10, 11.5)]:
        for y in range(16):
            for x in range(16):
                if (x - cx) ** 2 + (y - cy) ** 2 <= 5:
                    px(im, o + x, y, 'N')
    rect(im, o + 6, 6, o + 9, 9, 'f')
    # snowflake (winter)
    o = at(12)
    for i in range(1, 15):
        px(im, o + i, 7, 'B'); px(im, o + 7, i, 'B')
        if 3 <= i <= 12:
            px(im, o + i, i, 'l'); px(im, o + 15 - i, i, 'l')
    # code (</>)
    o = at(13)
    box(im, o + 0, 2, o + 15, 13, 'g')
    for i in range(3):
        px(im, o + 3 + i, 7 - i, 'C'); px(im, o + 3 + i, 8 + i, 'C')     # <
        px(im, o + 12 - i, 7 - i, 'C'); px(im, o + 12 - i, 8 + i, 'C')   # >
    for i in range(6):
        px(im, o + 9 - i, 5 + i, 'f')   # the "/" in </>
    # briefcase
    o = at(14)
    box(im, o + 1, 5, o + 14, 13, 'W')
    box(im, o + 5, 2, o + 10, 5, 'D')
    rect(im, o + 6, 3, o + 9, 4, (0, 0, 0, 0))
    rect(im, o + 2, 8, o + 13, 8, 'D')
    rect(im, o + 7, 7, o + 8, 9, 'f')
    # sprout (garden)
    o = at(15)
    rect(im, o + 7, 6, o + 8, 14, 'v')
    for i in range(5):
        px(im, o + 6 - i, 6 - i // 2, 'V'); px(im, o + 6 - i, 7 - i // 2, 'v')
        px(im, o + 9 + i, 5 - i // 2, 'V'); px(im, o + 9 + i, 6 - i // 2, 'v')
    rect(im, o + 4, 14, o + 11, 15, 'D')
    save(im, 'icons.png', UI)
    print('icon order:', ICON_NAMES)


# ---------------------------------------------------------------- UI frame (9-slice)
def ui_frame():
    """32x32 wood frame with parchment interior; CSS border-image slice 10."""
    im = new(32, 32)
    rect(im, 1, 0, 30, 31, hexc('3b1e12'))
    rect(im, 0, 1, 31, 30, hexc('3b1e12'))
    rect(im, 1, 1, 30, 30, hexc('a0522d'))
    rect(im, 2, 2, 29, 29, hexc('d9822b'))
    rect(im, 3, 3, 28, 28, hexc('a0522d'))
    rect(im, 4, 4, 27, 27, hexc('5b2c1c'))
    rect(im, 5, 5, 26, 26, hexc('f9e0ae'))
    rect(im, 2, 2, 29, 2, hexc('f2a54a'))   # top highlight
    # corner studs
    for (x, y) in [(2, 2), (28, 2), (2, 28), (28, 28)]:
        rect(im, x, y, x + 1, y + 1, hexc('f7c66b'))
    save(im, 'frame.png', UI)

    # darker variant for buttons/tabs
    im2 = new(16, 16)
    rect(im2, 1, 0, 14, 15, hexc('3b1e12'))
    rect(im2, 0, 1, 15, 14, hexc('3b1e12'))
    rect(im2, 1, 1, 14, 14, hexc('d9822b'))
    rect(im2, 2, 2, 13, 13, hexc('f2b25a'))
    rect(im2, 1, 13, 14, 14, hexc('a0522d'))
    save(im2, 'button.png', UI)


if __name__ == '__main__':
    bulletin_board()
    tv()
    mailbox()
    portrait()
    fireplace()
    rug_big()
    doormat()
    papers()
    grass_tiles()
    ui_icons()
    ui_frame()
