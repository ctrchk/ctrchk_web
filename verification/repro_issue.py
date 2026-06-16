import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Emulate PWA standalone mode
        context = await browser.new_context(
            viewport={'width': 390, 'height': 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            is_mobile=True,
            has_touch=True,
        )
        page = await context.new_page()

        print("Navigating to Home (PWA mode)...")
        await page.goto("http://localhost:3000/?pwa=true")

        # Wait for potential redirects
        await asyncio.sleep(2)

        current_url = page.url
        print(f"Current URL: {current_url}")

        # Take a screenshot to see what happened
        await page.screenshot(path="verification_home.png")

        # Check if tutorial is visible and close it
        tutorial = page.locator("#app-tutorial-overlay")
        if await tutorial.is_visible():
            print("Closing tutorial overlay...")
            await page.click("text=明白了！")
            await asyncio.sleep(0.5)
            await page.screenshot(path="verification_tutorial_closed.png")

        # Check if we are still on home
        if "/dashboard" in current_url:
            print("FAILED: Redirected to Dashboard unexpectedly.")
        else:
            print("SUCCESS: Remained on Home page.")

        # Test navigation to Routes
        print("Clicking Ride tab...")
        await page.click("#app-bottom-nav a:has-text('騎行')")
        await asyncio.sleep(2)
        print(f"Current URL after click: {page.url}")
        await page.screenshot(path="verification_routes.png")

        # Verify it's an SPA navigation (check for pwa-shell)
        shell_exists = await page.locator("#pwa-shell").count() > 0
        if shell_exists:
            print("Verified: SPA shell is present.")
            active_container = await page.locator(".pwa-page-container.active").get_attribute("id")
            print(f"Active container ID: {active_container}")
        else:
            print("FAILED: SPA shell missing.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
