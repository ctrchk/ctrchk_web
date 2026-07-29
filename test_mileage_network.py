import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Listen to request and response
        page.on("request", lambda req: print(f"REQ: {req.method} {req.url}"))
        page.on("response", lambda res: print(f"RES: {res.status} {res.url}") if res.status >= 400 else None)

        print("--- Loading mileage.html as guest ---")
        try:
            await page.goto('http://localhost:3000/mileage.html', timeout=5000)
            await page.wait_for_timeout(2000)
        except Exception as e:
            print("Failed to load page:", e)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
