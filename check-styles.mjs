import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({ colorScheme: 'dark' });
const page = await context.newPage();

await page.goto('http://localhost:3000');
await page.waitForSelector('button:has-text("Réserver")', { timeout: 10000 });

const buttonBg = await page.locator('button:has-text("Réserver")').first().evaluate(el => {
  const style = window.getComputedStyle(el);
  return { bg: style.backgroundColor, border: style.borderColor };
});

const badgeBg = await page.locator('text=Vérifié PURAMA').evaluate(el => {
  const style = window.getComputedStyle(el.parentElement);
  return { bg: style.backgroundColor, border: style.borderColor };
});

const heroIcon = await page.locator('svg').first().evaluate(el => el.outerHTML);

console.log('BUTTON:', JSON.stringify(buttonBg));
console.log('BADGE:', JSON.stringify(badgeBg));
console.log('HERO_SVG:', heroIcon.includes('circle') ? 'SVG patte présent' : 'EMOJI ou autre');

await browser.close();
