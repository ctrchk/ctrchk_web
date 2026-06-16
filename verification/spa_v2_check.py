import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 390, 'height': 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            is_mobile=True,
            has_touch=True,
        )
        page = await context.new_page()

        # Helper to check console
        page.on('console', lambda msg: print(f'CONSOLE: {msg.text}'))

        print("--- Step 1: Home ---")
        await page.goto("http://localhost:3000/?pwa=true")
        await asyncio.sleep(4) # Wait for pre-fetch

        # Close tutorial if visible
        tutorial = page.locator("#app-tutorial-overlay")
        if await tutorial.is_visible():
            await page.click("text=明白了！")
            await asyncio.sleep(0.5)

        print("--- Step 2: Routes ---")
        await page.click("#app-bottom-nav a:has-text('騎行')")
        await asyncio.sleep(3)
        await page.screenshot(path="v2_routes.png")
        # Check for leaflet map
        map_exists = await page.locator(".leaflet-container").count() > 0
        print(f"Leaflet Map exists: {map_exists}")
        route_count = await page.locator(".app-route-card").count()
        print(f"Route card count: {route_count}")

        print("--- Step 3: Nav ---")
        await page.click("#app-bottom-nav a:has-text('導航')")
        await asyncio.sleep(3)
        await page.screenshot(path="v2_nav.png")
        # Check for mapbox map
        mapbox_exists = await page.locator(".mapboxgl-map").count() > 0
        print(f"Mapbox Map exists: {mapbox_exists}")
        loading_hidden = await page.locator("#loading-overlay").is_hidden()
        print(f"Loading overlay hidden: {loading_hidden}")

        print("--- Step 4: Dashboard ---")
        await page.click("#app-bottom-nav a:has-text('登入')")
        await asyncio.sleep(2)
        await page.screenshot(path="v2_dashboard.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
