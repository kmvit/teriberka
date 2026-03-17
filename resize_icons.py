from PIL import Image

out = "/Users/home/PycharmProjects/teriberka/frontend/public"
src = Image.open(out + "/pwa-512x512.png").convert("RGBA")

def mk(logo, size, pad, bg=(255, 255, 255, 255)):
    c = Image.new("RGBA", (size, size), bg)
    inner = int(size * (1 - 2 * pad))
    r = logo.resize((inner, inner), Image.Resampling.LANCZOS)
    o = (size - inner) // 2
    c.paste(r, (o, o), r)
    return c

mk(src, 512, 0.15).save(out + "/pwa-512x512.png", "PNG")
mk(src, 192, 0.15).save(out + "/pwa-192x192.png", "PNG")
mk(src, 512, 0.20, bg=(74, 111, 165, 255)).save(out + "/pwa-maskable-512x512.png", "PNG")
mk(src, 180, 0.12).save(out + "/apple-touch-icon-180x180.png", "PNG")
print("Done")
