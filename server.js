require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000; 

app.get('/run', async (req, res) => {
try {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser', // Tell Puppeteer to use this Chromium
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',     // Often needed in constrained Docker/server environments
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'                // Can help in headless server environments
    ],
  });
  page = await browser.newPage();
  const page = await browser.newPage();

  try {
    await page.goto('https://cryptorecherche.com/login', { waitUntil: 'networkidle0' });
    await page.type('#email', process.env.CR_EMAIL);
    await page.type('#password', process.env.CR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    await page.goto('https://cryptorecherche.com/articles', { waitUntil: 'networkidle0' });

    const data = await page.evaluate(() => {
      const article = document.querySelector('.elementor-post');
      return {
        title: article?.querySelector('.elementor-post__title')?.innerText || '',
        link: article?.querySelector('a')?.href || '',
        video: article?.querySelector('iframe')?.src || '',
        date: new Date().toISOString(),
      };
    });

    await browser.close();
    res.json(data);
  } catch (err) {
    await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});