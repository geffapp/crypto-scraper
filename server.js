require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/run', async (req, res) => {
  let browser; // Define browser outside try for access in finally
  let page;    // Define page outside try for access in finally

  try { // OUTER TRY for the entire request
    console.log("Attempting to launch browser...");
    browser = await puppeteer.launch({
      headless: true,
      // No executablePath specified - Puppeteer will try to use its own bundled/downloaded Chromium
      // This is often more reliable in PaaS environments like Railway.
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',     // Crucial for Docker/CI environments
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'                // Often helpful in headless server environments
      ],
    });
    console.log("Browser launched successfully.");
    page = await browser.newPage();
    console.log("New page created.");

    // Optional: Set up console listener for debugging page.evaluate
    // page.on('console', async msg => {
    //   for (let i = 0; i < msg.args().length; ++i) {
    //     const arg = msg.args()[i];
    //     try {
    //       const val = await arg.jsonValue();
    //       console.log(`BROWSER LOG (page.evaluate): Arg ${i}:`, val);
    //     } catch (e) {
    //       console.log(`BROWSER LOG (page.evaluate): Arg ${i} (raw): ${arg}`);
    //     }
    //   }
    // });

    // --- Login and navigate ---
    console.log("Navigating to login page: https://cryptorecherche.com/login");
    await page.goto('https://cryptorecherche.com/login', { waitUntil: 'networkidle0', timeout: 60000 }); // Increased timeout
    
    console.log("Attempting to fill login form...");
    // Using selectors from your latest snippet. Verify these are correct for the login page.
    await page.type('#email', process.env.CR_EMAIL); 
    await page.type('#password', process.env.CR_PASSWORD);
    await page.click('button[type="submit"]'); // Verify this button selector
    
    console.log("Login submitted. Waiting for navigation...");
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }); // Increased timeout
    console.log("Current URL after login attempt:", page.url());
    // await page.screenshot({ path: 'screenshot_after_login_attempt.png', fullPage: true }); // Optional for debugging


    console.log("Navigating to articles list page: https://cryptorecherche.com/articles");
    await page.goto('https://cryptorecherche.com/articles', { waitUntil: 'networkidle0', timeout: 60000 }); // Increased timeout
    // await page.screenshot({ path: 'screenshot_articles_list_page.png', fullPage: true }); // Optional for debugging
    console.log("Current URL on articles list page:", page.url());

    // --- Simplified scraping from the /articles list page ---
    console.log("Extracting data from the articles list page...");
    const data = await page.evaluate(() => {
      const articleElement = document.querySelector('.elementor-post'); // Targets the first match
      
      const title = articleElement?.querySelector('.elementor-post__title')?.innerText.trim() || 'Title not found on list page';
      const link = articleElement?.querySelector('a')?.href || 'Link not found on list page';
      const video = articleElement?.querySelector('iframe')?.src || 'Video not found on list page (expected)';

      return {
        title: title,
        link: link,
        video: video,
        date: new Date().toISOString(),
      };
    });

    console.log("Data extracted:", data);
    res.json(data);

  } catch (err) { // CATCH FOR THE OUTER TRY
    console.error("Error during Puppeteer script execution:", err.message);
    console.error(err.stack); // Log the full stack trace for more details

    if (page && !res.headersSent) {
        try {
            const errorScreenshotPath = `error_screenshot_${Date.now()}.png`;
            // await page.screenshot({ path: errorScreenshotPath, fullPage: true }); // Screenshots might not work if browser crashed
            console.log(`📸 Attempted to take error screenshot: ${errorScreenshotPath} (may fail if browser crashed)`);
        } catch (screenshotError) {
            console.error("Could not take screenshot on error:", screenshotError.message);
        }
    }
    if (!res.headersSent) {
        res.status(500).json({ error: err.message, details: "An error occurred during scraping." });
    }
  } finally { // FINALLY FOR THE OUTER TRY
    if (browser) {
      console.log("Closing browser in finally block...");
      try {
        await browser.close();
        console.log("Browser closed.");
      } catch (closeError) {
        console.error("Error closing browser:", closeError.message);
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
