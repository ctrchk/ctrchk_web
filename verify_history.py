import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        # Mocking local storage isn't easy here without a real login,
        # but we can check if the page loads and has the right elements.
        await page.goto('http://localhost:3000/ride_history_detail.html?id=123')

        # Take a screenshot of the error state (since not logged in)
        await page.screenshot(path='history_detail_error.png')

        print("Page Title:", await page.title())
        print("Body text contains error:", "無法找到該騎行紀錄" in await page.content())

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
