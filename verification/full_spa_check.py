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

        print("--- Step 1: Home ---")
        await page.goto("http://localhost:3000/?pwa=true")
        await asyncio.sleep(3) # Wait for pre-fetch
        await page.screenshot(path="v_spa_1_home.png")

        # Close tutorial if visible
        tutorial = page.locator("#app-tutorial-overlay")
        if await tutorial.is_visible():
            print("Closing tutorial...")
            await page.click("text=明白了！")
            await asyncio.sleep(0.5)

        print("--- Step 2: Tasks ---")
        await page.click("#app-bottom-nav a:has-text('任務')")
        await asyncio.sleep(1)
        await page.screenshot(path="v_spa_2_tasks.png")

        print("--- Step 3: Ride (Routes) ---")
        await page.click("#app-bottom-nav a:has-text('騎行')")
        await asyncio.sleep(1)
        await page.screenshot(path="v_spa_3_routes.png")

        print("--- Step 4: Nav ---")
        await page.click("#app-bottom-nav a:has-text('導航')")
        await asyncio.sleep(2)
        await page.screenshot(path="v_spa_4_nav.png")

        print("--- Step 5: My (Dashboard) ---")
        await page.click("#app-bottom-nav a:has-text('登入')") # Unlogged state says '登入'
        await asyncio.sleep(1)
        await page.screenshot(path="v_spa_5_login.png")

        print("--- Step 6: Verify SPA shell ---")
        shell_count = await page.locator("#pwa-shell").count()
        print(f"PWA Shell count: {shell_count}")
        containers = await page.locator(".pwa-page-container").count()
        print(f"Containers count: {containers}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
