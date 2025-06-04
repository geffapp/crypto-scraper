require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000; 

app.get('/run', async (req, res) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
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