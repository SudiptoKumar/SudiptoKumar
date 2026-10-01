import numpy as np
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
from scipy import ndimage
import json

from step1_mask import load_and_crop, segmentation_mask, GRID_W, GRID_H


def preprocess_gray(img_rgb):
    gray = ImageOps.grayscale(img_rgb)
    gray = ImageOps.autocontrast(gray, cutoff=1)
    gray = gray.resize((GRID_W, GRID_H), Image.LANCZOS)
    gray = ImageEnhance.Contrast(gray).enhance(1.3)
    gray = gray.filter(ImageFilter.UnsharpMask(radius=3, percent=140, threshold=0))
    return np.array(gray).astype(np.float64) / 255.0  # 0..1


def resize_mask(mask_bool, w, h):
    m = Image.fromarray((mask_bool * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
    return np.array(m) > 127


def serpentine_dither(value):
    """value: float array in [0,1], 1 = 'wants a dot'. Returns uint8 binary array."""
    h, w = value.shape
    buf = value.copy()
    out = np.zeros((h, w), dtype=np.uint8)
    for y in range(h):
        left_to_right = (y % 2 == 0)
        xs = range(w) if left_to_right else range(w - 1, -1, -1)
        for x in xs:
            old = buf[y, x]
            new = 1.0 if old >= 0.5 else 0.0
            out[y, x] = int(new)
            err = old - new
            if left_to_right:
                if x + 1 < w:
                    buf[y, x + 1] += err * 7 / 16
                if y + 1 < h:
                    if x - 1 >= 0:
                        buf[y + 1, x - 1] += err * 3 / 16
                    buf[y + 1, x] += err * 5 / 16
                    if x + 1 < w:
                        buf[y + 1, x + 1] += err * 1 / 16
            else:
                if x - 1 >= 0:
                    buf[y, x - 1] += err * 7 / 16
                if y + 1 < h:
                    if x + 1 < w:
                        buf[y + 1, x + 1] += err * 3 / 16
                    buf[y + 1, x] += err * 5 / 16
                    if x - 1 >= 0:
                        buf[y + 1, x - 1] += err * 1 / 16
    return out


def mask_to_runs(mask):
    runs = []
    H, W = mask.shape
    for y in range(H):
        x = 0
        while x < W:
            if mask[y, x]:
                x0 = x
                while x < W and mask[y, x]:
                    x += 1
                runs.append((int(x0), int(y), int(x - x0)))
            else:
                x += 1
    return runs


def ink_coverage(mask):
    return float(mask.mean())


if __name__ == "__main__":
    img = load_and_crop("/home/claude/build/photo.png")
    fg_mask, bg_mean, thresh = segmentation_mask(img)
    gray01 = preprocess_gray(img)
    grid_mask = resize_mask(fg_mask, GRID_W, GRID_H)

    # LIGHT MODE: dots draw the dark parts of the photo, background kept (no masking),
    # but clip near-zero noise so a faint vignette in the backdrop doesn't fleck into stray dots
    light_value = 1.0 - gray01
    light_value[light_value < 0.05] = 0.0
    light_dots = serpentine_dither(light_value)

    # DARK MODE: dots draw the lit subject; background segmented out pre- and post-dither
    dark_value = gray01.copy()
    dark_value[~grid_mask] = 0.0
    dark_dots = serpentine_dither(dark_value)
    dark_dots = dark_dots & grid_mask  # hard-clear any error-diffusion bleed past the mask edge

    print("light ink coverage:", round(ink_coverage(light_dots), 4))
    print("dark ink coverage:", round(ink_coverage(dark_dots), 4))

    light_runs = mask_to_runs(light_dots)
    dark_runs = mask_to_runs(dark_dots)
    print("light runs:", len(light_runs), " dark runs:", len(dark_runs))

    json.dump({"grid_w": GRID_W, "grid_h": GRID_H, "runs": light_runs},
               open("/home/claude/build/portrait_light_runs.json", "w"))
    json.dump({"grid_w": GRID_W, "grid_h": GRID_H, "runs": dark_runs},
               open("/home/claude/build/portrait_dark_runs.json", "w"))

    # quick raster previews
    for name, dots in (("light", light_dots), ("dark", dark_dots)):
        im = Image.fromarray((dots * 255).astype(np.uint8))
        im.save(f"/home/claude/build/portrait_{name}_dots.png")
