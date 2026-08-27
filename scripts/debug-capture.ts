import { chromium } from '@playwright/test';
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, colorScheme: 'dark' });
  await page.goto('http://localhost:3000/prof/c0000000-0000-4000-8000-000000000001', { waitUntil: 'networkidle' });
  
  await page.waitForFunction(() => {
    const body = document.body;
    const h1 = document.querySelector('h1');
    if (!body || !h1) return false;
    const bgColor = window.getComputedStyle(body).backgroundColor;
    const h1Font = window.getComputedStyle(h1).fontFamily;
    return bgColor.includes('rgb(10, 10, 15)') && h1Font.toLowerCase().includes('fraunces');
  }, { timeout: 10000 });
  
  const h1Text = await page.locator('h1').textContent();
  const prenomP = page.locator('p.mb-3.text-lg').first();
  const prenomText = await prenomP.textContent().catch(() => 'ABSENT');
  
  console.log('✅ h1:', h1Text);
  console.log('✅ prénom (<p class="mb-3 text-lg">):', prenomText);
  
  await page.screenshot({ path: 'screenshots/debug-375.png' });
  await browser.close();
})();
