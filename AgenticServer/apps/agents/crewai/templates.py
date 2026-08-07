from typing import Any, Dict, List
import random

def render_instagram_slides(carousel_data: Dict[str, Any]) -> List[str]:
    """
    Transforms structured JSON slide data into high-end geometric glow designs.
    Matches the pure black background + polygon + blurred orb aesthetic.
    """
    slides = carousel_data.get("slides", [])
    html_slides = []

    # Dynamic Geometric Themes
    themes = [
        {"primary": "#6d28d9", "secondary": "#10b981", "orb": "#ef4444"}, # Purple, Green, Red Orb
        {"primary": "#2563eb", "secondary": "#f59e0b", "orb": "#38bdf8"}, # Blue, Orange, Light Blue Orb
        {"primary": "#be123c", "secondary": "#4338ca", "orb": "#facc15"}, # Crimson, Indigo, Yellow Orb
        {"primary": "#059669", "secondary": "#7c3aed", "orb": "#fb7185"}, # Emerald, Violet, Rose Orb
    ]

    for index, slide in enumerate(slides):
        title = slide.get("title", "")
        body = slide.get("body", "")
        
        # Pick a theme based on index or randomly
        current_theme = themes[index % len(themes)]
        
        # Randomize polygon rotations for unique feel
        rot1 = random.randint(-20, 20)
        rot2 = random.randint(140, 180)

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                body, html {{
                    margin: 0; padding: 0;
                    width: 1080px; height: 1080px;
                    font-family: 'Inter', sans-serif;
                    background: #000;
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    position: relative;
                }}
                
                /* Large Geometric Polygons */
                .polygon {{
                    position: absolute;
                    z-index: 1;
                    opacity: 0.8;
                }}
                .poly-1 {{
                    width: 800px; height: 800px;
                    background: {current_theme['primary']};
                    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
                    top: -200px; left: -200px;
                    transform: rotate({rot1}deg);
                }}
                .poly-2 {{
                    width: 700px; height: 700px;
                    background: {current_theme['secondary']};
                    clip-path: polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%);
                    bottom: -150px; right: -150px;
                    transform: rotate({rot2}deg);
                }}
                
                /* Blurred Glow Orbs */
                .orb {{
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(120px);
                    z-index: 0;
                    opacity: 0.4;
                    background: {current_theme['orb']};
                }}
                .orb-1 {{ width: 400px; height: 400px; top: 10%; right: 10%; }}
                .orb-2 {{ width: 350px; height: 350px; bottom: 20%; left: 5%; }}
                
                /* Centered Content Card */
                .container {{
                    width: 820px;
                    padding: 60px;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    z-index: 10;
                    text-align: center;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.5);
                }}
                
                .title {{
                    font-size: 82px;
                    font-weight: 900;
                    line-height: 1.1;
                    margin-bottom: 30px;
                    letter-spacing: -2px;
                }}
                
                .body {{
                    font-size: 40px;
                    font-weight: 400;
                    line-height: 1.5;
                    color: rgba(255, 255, 255, 0.9);
                }}

                .footer {{
                    margin-top: 50px;
                    font-size: 18px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 4px;
                    opacity: 0.5;
                }}
                
                .slide-counter {{
                    display: inline-block;
                    margin-top: 15px;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 4px 12px;
                    border-radius: 6px;
                }}
            </style>
        </head>
        <body>
            <div class="orb orb-1"></div>
            <div class="orb orb-2"></div>
            
            <div class="polygon poly-1"></div>
            <div class="polygon poly-2"></div>
            
            <div class="container">
                <div class="title">{title}</div>
                <div class="body">{body}</div>
                <div class="footer">
                    <div>Expert Insight</div>
                    <div class="slide-counter">{index + 1} / {len(slides)}</div>
                </div>
            </div>
        </body>
        </html>
        """
        html_slides.append(html)

    return html_slides
