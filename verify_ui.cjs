const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to a common mobile size
  await page.setViewportSize({ width: 375, height: 812 });

  console.log('--- Testing Routes Page ---');
  await page.goto('http://localhost:3000/routes.html');
  await page.waitForTimeout(2000);

  // Select first route to check card height
  const routeCard = page.locator('.app-route-card').first();
  await routeCard.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verify_routes_card.png' });

  console.log('--- Testing Ride Page (Leaflet) ---');
  // Navigate to ride.html with a route ID to trigger the HUD
  await page.goto('http://localhost:3000/ride.html?id=1');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verify_ride_leaflet.png' });

  // Check if skip button exists and click it
  const skipBtn = page.locator('#btn-skip-loading');
  if (await skipBtn.isVisible()) {
    console.log('Skip button found, clicking...');
    await skipBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verify_ride_after_skip.png' });
  }

  await browser.close();
})();
