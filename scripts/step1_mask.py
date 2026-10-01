import numpy as np
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
from scipy import ndimage

GRID_W, GRID_H = 300, 340

def load_and_crop(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    target_ratio = GRID_W / GRID_H  # 0.882
    cur_ratio = w / h
    if cur_ratio > target_ratio:
        # too wide -> crop width, keep full height
        new_w = int(h * target_ratio)
        x0 = (w - new_w) // 2
        img = img.crop((x0, 0, x0 + new_w, h))
    else:
        # too tall -> crop height, keep full width
        new_h = int(w / target_ratio)
        y0 = 0  # keep top (head), crop from bottom
        img = img.crop((0, y0, w, y0 + new_h))
    return img

def bg_color_sample(img_rgb):
    arr = np.array(img_rgb).astype(np.float64)
    h, w, _ = arr.shape
    patch = 40
    corners = [
        arr[0:patch, 0:patch],
        arr[0:patch, w-patch:w],
    ]
    samples = np.concatenate([c.reshape(-1, 3) for c in corners], axis=0)
    mean = samples.mean(axis=0)
    std = samples.std(axis=0).mean()
    return mean, std

def segmentation_mask(img_rgb):
    arr = np.array(img_rgb).astype(np.float64)
    bg_mean, bg_std = bg_color_sample(img_rgb)
    dist = np.sqrt(((arr - bg_mean) ** 2).sum(axis=2))
    dist = ndimage.gaussian_filter(dist, sigma=3.0)  # smooth soft shadow/vignette noise near edges
    thresh = max(34.0, bg_std * 6.0)
    fg = dist > thresh
    # clean speckle, smooth + fill + keep largest component
    fg = ndimage.binary_opening(fg, structure=np.ones((6, 6)), iterations=1)
    fg = ndimage.binary_closing(fg, structure=np.ones((7, 7)), iterations=2)
    fg = ndimage.binary_fill_holes(fg)
    labeled, n = ndimage.label(fg)
    if n > 0:
        sizes = ndimage.sum(fg, labeled, range(1, n + 1))
        biggest = np.argmax(sizes) + 1
        fg = labeled == biggest
    return fg, bg_mean, thresh

if __name__ == "__main__":
    img = load_and_crop("/home/claude/build/photo.png")
    print("cropped size", img.size)
    img.save("/home/claude/build/photo_cropped.png")
    mask, bg_mean, thresh = segmentation_mask(img)
    print("bg_mean", bg_mean, "thresh", thresh, "fg fraction", mask.mean())
    mask_img = Image.fromarray((mask * 255).astype(np.uint8))
    mask_img.save("/home/claude/build/mask_preview.png")
