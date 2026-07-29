import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Listen to console events
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text} ({msg.type})"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err.message}"))

        print("--- Loading mileage.html as guest ---")
        try:
            await page.goto('http://localhost:3000/mileage.html', timeout=5000)
            await page.wait_for_timeout(2000)
            print("Page title:", await page.title())
        except Exception as e:
            print("Failed to load page:", e)

        # Mock a token in localStorage and check
        print("--- Loading mileage.html with mock invalid token ---")
        await page.goto('http://localhost:3000/')
        await page.evaluate("localStorage.setItem('accessToken', 'mock-token')")
        try:
            await page.goto('http://localhost:3000/mileage.html', timeout=5000)
            await page.wait_for_timeout(2000)
        except Exception as e:
            print("Failed to load with mock token:", e)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
