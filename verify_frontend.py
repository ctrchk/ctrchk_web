import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 390, 'height': 844}) # iPhone 12 Pro size

        # Set mock user with Gold rank and streak
        await page.add_init_script("""
            localStorage.setItem('accessToken', 'mock_token');
            localStorage.setItem('user', JSON.stringify({
                id: 1,
                full_name: '測試金卡用戶',
                mileage_rank: 'gold',
                mileage_card: '金卡',
                level: 15,
                xp: 12000,
                coins: 500,
                email_verified: true,
                role: 'senior_admin',
                commute_streak: 5
            }));
        """)

        # 1. Home Page
        await page.goto('http://localhost:8000/index.html')
        await page.wait_for_timeout(2000)
        # Mock PWA mode
        await page.evaluate("document.body.classList.add('is-pwa')")
        # Add rank-gold class to test theme
        await page.evaluate("document.body.className = 'rank-gold is-pwa'")
        await page.screenshot(path='home_gold_verify.png')
        print("Captured home_gold_verify.png")

        # 2. Dashboard
        await page.goto('http://localhost:8000/dashboard.html')
        await page.wait_for_timeout(2000)
        await page.evaluate("document.body.className = 'rank-gold is-pwa'")
        await page.screenshot(path='dashboard_verify.png')
        print("Captured dashboard_verify.png")

        # 3. Navigation (Waypoints & UI)
        await page.goto('http://localhost:8000/nav.html')
        await page.wait_for_timeout(2000)
        # Click handle to expand
        await page.click('#panel-handle')
        # Add a waypoint
        await page.click('#btn-add-waypoint')
        await page.screenshot(path='nav_verify.png')
        print("Captured nav_verify.png")

        # 4. Weather
        await page.goto('http://localhost:8000/weather.html')
        await page.wait_for_timeout(2000)
        await page.screenshot(path='weather_verify.png')
        print("Captured weather_verify.png")

        # 5. Admin
        await page.goto('http://localhost:8000/admin.html')
        await page.wait_for_timeout(2000)
        await page.screenshot(path='admin_verify.png')
        print("Captured admin_verify.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(verify())
