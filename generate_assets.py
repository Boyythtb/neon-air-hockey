import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_og_image():
    W, H = 1200, 630
    im = Image.new('RGB', (W, H), '#fdf2f8')
    d = ImageDraw.Draw(im)

    # 1. Nền ấm áp & vân gỗ Parquet thể thao
    d.rectangle([0, 0, W, H], fill='#fdf2f8')
    for y in range(0, H, 24):
        d.line([(0, y), (W, y)], fill='#fce7f3', width=1)

    # 2. Sân Air Hockey 3D Isometric chính giữa
    table_box = [160, 100, 1040, 560]
    # Bóng đổ bàn
    d.rounded_rectangle([170, 115, 1050, 575], radius=48, fill='#fbcfe8')
    # Thân bàn Deep Navy
    d.rounded_rectangle(table_box, radius=48, fill='#1e1b4b')
    # Mặt bàn Mint Green
    inner_box = [184, 124, 1016, 536]
    d.rounded_rectangle(inner_box, radius=36, fill='#34d399')

    # Lỗ đệm khí vi mô
    for y in range(140, 520, 24):
        for x in range(200, 1000, 24):
            d.rectangle([x, y, x+3, y+3], fill='#10b981')

    # Vạch chia đôi giữa sân
    d.line([(600, 124), (600, 536)], fill='#ffffff', width=8)
    # Vòng tròn trung tâm
    d.ellipse([480, 210, 720, 450], outline='#ffffff', width=8)
    d.ellipse([575, 305, 625, 355], fill='#f43f5e')

    # Vòng gôn 2 bên
    d.arc([100, 180, 360, 480], start=-90, end=90, fill='#ffffff', width=8)
    d.arc([840, 180, 1100, 480], start=90, end=270, fill='#ffffff', width=8)

    # 3. Vẽ 2 Mallet và Quả Đĩa Puck
    # Mallet P1 (Xanh Sky Blue bên trái)
    d.ellipse([320, 280, 440, 400], fill='#0284c7', outline='#ffffff', width=6)
    d.ellipse([355, 315, 405, 365], fill='#38bdf8')
    d.ellipse([365, 325, 395, 355], fill='#0284c7')

    # Mallet P2 (Đỏ Hồng Rose bên phải)
    d.ellipse([760, 260, 880, 380], fill='#f43f5e', outline='#ffffff', width=6)
    d.ellipse([795, 295, 845, 345], fill='#fb7185')
    d.ellipse([805, 305, 835, 335], fill='#f43f5e')

    # Quả đĩa Puck Vàng ở giữa đang vút đi
    d.ellipse([520, 300, 580, 360], fill='#f59e0b', outline='#ffffff', width=4)
    d.ellipse([538, 318, 562, 342], fill='#fef08a')

    # 4. Banner Tiêu đề Logo đỉnh cao
    try:
        font_big = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 72)
        font_sub = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 26)
        font_badge = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 16)
    except:
        font_big = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_badge = ImageFont.load_default()

    # Badge Studio
    d.rounded_rectangle([490, 24, 710, 62], radius=19, fill='#ffffff', outline='#f43f5e', width=2)
    d.text((600, 43), "✨ TBOY STUDIO PRESENTS ✨", font=font_badge, fill='#f43f5e', anchor="mm")

    # Logo Text
    d.text((600, 185), "AIR HOCKEY 3D", font=font_big, fill='#1e1b4b', anchor="mm")
    d.text((600, 182), "AIR HOCKEY 3D", font=font_big, fill='#fb7185', anchor="mm")

    # Subtitle
    d.rounded_rectangle([380, 565, 820, 610], radius=22, fill='#ffffff', outline='#fb7185', width=2)
    d.text((600, 587), "🥏 SOLO AI & ĐẤU MẠNG REALTIME ĐỈNH CAO", font=font_sub, fill='#1e1b4b', anchor="mm")

    im.save('d:/Code web/neon-air-hockey/public/og-image.png', 'PNG')
    print("Created og-image.png")

def create_app_icons():
    # Icon 512x512
    S = 512
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Nền bo góc tròn mượt chuẩn iOS / Android
    d.rounded_rectangle([0, 0, S, S], radius=110, fill='#1e1b4b')
    d.rounded_rectangle([18, 18, S-18, S-18], radius=96, fill='#34d399')

    # Kẻ sân vạch trắng
    d.line([(S//2, 18), (S//2, S-18)], fill='#ffffff', width=8)
    d.ellipse([140, 140, 372, 372], outline='#ffffff', width=8)
    d.ellipse([S//2-20, S//2-20, S//2+20, S//2+20], fill='#f43f5e')

    # Mallet 3D
    d.ellipse([160, 210, 352, 402], fill='#0284c7', outline='#ffffff', width=10)
    d.ellipse([210, 260, 302, 352], fill='#38bdf8')
    d.ellipse([230, 280, 282, 332], fill='#0284c7')

    # Đĩa Puck vàng nảy lên
    d.ellipse([300, 120, 420, 240], fill='#f59e0b', outline='#ffffff', width=8)
    d.ellipse([335, 155, 385, 205], fill='#fef08a')

    # Save các kích thước
    im.save('d:/Code web/neon-air-hockey/public/icon-512.png', 'PNG')
    im.resize((192, 192), Image.Resampling.LANCZOS).save('d:/Code web/neon-air-hockey/public/icon-192.png', 'PNG')
    im.resize((180, 180), Image.Resampling.LANCZOS).save('d:/Code web/neon-air-hockey/public/apple-touch-icon.png', 'PNG')
    im.resize((32, 32), Image.Resampling.LANCZOS).save('d:/Code web/neon-air-hockey/public/favicon-32x32.png', 'PNG')
    im.resize((16, 16), Image.Resampling.LANCZOS).save('d:/Code web/neon-air-hockey/public/favicon-16x16.png', 'PNG')
    print("Created icon-512, icon-192, apple-touch-icon, favicons!")

if __name__ == '__main__':
    create_og_image()
    create_app_icons()
