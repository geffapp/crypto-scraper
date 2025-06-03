require('dotenv').config();
console.log("Step 1: importing express");
const express = require('express');

console.log("Step 2: initializing app");
const app = express();

console.log("Step 3: defining PORT");
const PORT = 3000;

console.log("Step 4: setting up route");
app.get('/run', async (req, res) => {
  const puppeteer = require('puppeteer');
  let browser; // Define browser outside try for access in finally
  let page; // Define page for wider scope, useful for error screenshots

  try {
    browser = await puppeteer.launch({
      headless: true, // Set to false to watch the browser's actions for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    // ... after page = await browser.newPage();
    page.on('console', msg => {
      for (let i = 0; i < msg.args().length; ++i) {
        console.log(`BROWSER LOG (page.evaluate): ${i}: ${msg.args()[i]}`);
      }
    });
    // ... then page.goto(...)

    // --- Login and navigate to /articles page ---
    console.log("Navigating to login page...");
    await page.goto('https://cryptorecherche.com/login', { waitUntil: 'networkidle0' });
    console.log("📸 Taking login page screenshot...");
    await page.screenshot({ path: 'screenshot_1_login_page.png', fullPage: true });
    console.log("✅ Login screenshot taken.");

    await page.type('#user_login', process.env.CR_EMAIL);
    await page.type('#user_pass', process.env.CR_PASSWORD);
    await page.click('input[type="submit"]');
    console.log("Login submitted. Waiting for navigation...");
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log("Current URL after login attempt:", page.url());
    await page.screenshot({ path: 'screenshot_2_after_login.png', fullPage: true });


    console.log("Navigating to articles list page...");
    // ... after page = await browser.newPage();
    page.on('console', msg => {
      for (let i = 0; i < msg.args().length; ++i) {
        console.log(`BROWSER LOG (page.evaluate): ${i}: ${msg.args()[i]}`);
      }
    });
    // ... then page.goto(...)
    await page.goto('https://cryptorecherche.com/articles', { waitUntil: 'networkidle0' });
    console.log("📸 Taking articles list page screenshot...");
    await page.screenshot({ path: 'screenshot_3_articles_list.png', fullPage: true });
    console.log("✅ Articles list screenshot taken. Current URL:", page.url());

    const articleContainerSelector = 'div.jet-listing-grid__item'; // Container for each article in the list
    console.log(`Waiting for article container selector on list page: ${articleContainerSelector}`);
    try {
      await page.waitForSelector(articleContainerSelector, { timeout: 15000 });
      console.log(`✅ Found article container selector on list page: ${articleContainerSelector}`);
    } catch (e) {
      console.error(`🚨 Could not find selector ${articleContainerSelector} on the articles list page.`);
      await page.screenshot({ path: 'error_articles_list_no_container.png', fullPage: true });
      throw new Error(`Article container ${articleContainerSelector} not found on list page.`);
    }

    console.log("Extracting data from the latest article on list page...");
    const listingData = await page.evaluate((selectorForLatestArticle) => {
      const latestArticleElement = document.querySelector(selectorForLatestArticle);
      if (!latestArticleElement) {
        return {
          listingTitle: 'No article container found on list page',
          articleUrl: null,
          videoOnListing: null
        };
      }

      const linkElement = latestArticleElement.querySelector('a.post-content-hover[href]');
      const titleElement = latestArticleElement.querySelector('div.post-title'); // Based on your previous confirmation
      const videoElementListing = latestArticleElement.querySelector('iframe'); // Unlikely to find video here

      return {
        listingTitle: titleElement ? titleElement.innerText.trim() : 'No title found on listing (check div.post-title)',
        articleUrl: linkElement ? linkElement.href : null,
        videoOnListing: videoElementListing ? videoElementListing.src : null
      };
    }, articleContainerSelector);

    let combinedData = {
      ...listingData, // Includes listingTitle, articleUrl, videoOnListing
      scrapeDate: new Date().toISOString(),
      // Placeholders for article page specific data
      articlePageTitle: null,
      sections: [],
      videoUrlOnPage: null,
      mentionedLinks: []
    };

    // --- Navigate to article detail page if link exists ---
    if (listingData.articleUrl && !listingData.articleUrl.startsWith('No link found')) {
      console.log(`Navigating to article page: ${listingData.articleUrl}`);
      
      await page.goto(listingData.articleUrl, { waitUntil: 'networkidle0' });
      console.log(`📸 Taking screenshot of article detail page: ${listingData.articleUrl}`);
      await page.screenshot({ path: 'screenshot_4_article_detail.png', fullPage: true });
      console.log("Current URL on article detail page:", page.url());

// This is the const articleDetailData = await page.evaluate(() => { ... }); block
// Make sure to replace your existing one with this.

const articleDetailData = await page.evaluate(() => {
    // --- USER MUST VERIFY THESE SELECTORS ---
    // 1. Main H1 title of the article page itself:
    const articlePageTitleSelector = 'h1.entry-title, h1.post-title, h1.elementor-heading-title';
// Inside the articleDetailData = await page.evaluate(() => { ... }); block

// 2. The ONE div/article tag that wraps ALL the article's main content (text, sections, images, videos):
const mainContentAreaSelector = 'div.elementor-widget-theme-post-content';
// This targets the Elementor widget that is specifically for displaying the post's content.
    const pageData = {
        articlePageTitle: document.querySelector(articlePageTitleSelector)?.innerText.trim() || 'ARTICLE PAGE TITLE NOT FOUND (check selector)',
        sections: [],
        videoUrlOnPage: null,
        mentionedLinks: []
    };

    const mainContentElement = document.querySelector(mainContentAreaSelector);

    if (!mainContentElement) {
        console.warn(`MAIN CONTENT AREA NOT FOUND with selector: ${mainContentAreaSelector}. No sections, video or links will be extracted.`);
        // To help debug, you could try returning the outerHTML of the body or a suspected parent
        // pageData.debug_bodyHTML = document.body.outerHTML.slice(0, 5000); // Example
        return pageData;
    }

    let currentSection = null;

    Array.from(mainContentElement.children).forEach(childNode => {
        // Ensure we only process Element nodes
        if (childNode.nodeType !== Node.ELEMENT_NODE) {
            return;
        }
        const child = childNode; // Now we know child is an Element

        // 1. Check for Section Title: <p><strong>Title Text</strong></p>
        //    The strong tag should be the primary content of the paragraph.
        let isSectionTitle = false;
        if (child.tagName === 'P' && child.children.length > 0 && child.firstElementChild?.tagName === 'STRONG') {
            const strongText = child.firstElementChild.innerText.trim();
            // Check if the paragraph's text is essentially just the strong text
            if (strongText && child.innerText.trim().startsWith(strongText) && child.innerText.trim().length < strongText.length + 15) { // Allow a bit of leeway for &nbsp; or minor chars
                if (currentSection) {
                    currentSection.text = currentSection.text.trim();
                    pageData.sections.push(currentSection);
                }
                currentSection = { title: strongText, text: '', images: [] };
                isSectionTitle = true;
            }
        }

        if (isSectionTitle) return; // Don't process the title paragraph as content

        // Create a default section if content appears before any explicit title
        if (!currentSection && (child.tagName === 'P' || child.matches('figure.wp-block-image'))) {
            currentSection = { title: 'General Content', text: '', images: [] };
        }

        if (currentSection) {
            if (child.tagName === 'P') {
                currentSection.text += child.innerText.trim() + '\n\n';
            } else if (child.matches('figure.wp-block-image')) {
                const img = child.querySelector('img');
                if (img) {
                    // Prioritize data-src (for lazy-loaded images), then src
                    const imgSrc = img.getAttribute('data-src') || img.getAttribute('src');
                    if (imgSrc && !imgSrc.startsWith('data:image/svg+xml')) { // Avoid SVG placeholders
                        currentSection.images.push(imgSrc);
                    } else if (imgSrc && imgSrc.startsWith('data:image/svg+xml')) {
                        // If only SVG placeholder is found, still add it or a note
                        // console.warn('Found SVG placeholder for image:', img.outerHTML);
                        // currentSection.images.push("SVG_PLACEHOLDER_IMAGE"); // Or actual SVG data if useful
                    }
                }
            }
        }

        // 2. Extract Video Link (still global for the article)
        let videoIframe = null;
        if (child.matches('figure.wp-block-embed.is-type-video iframe')) {
            videoIframe = child;
        } else if (child.matches('figure.wp-block-embed.is-type-video, div.wp-block-embed__wrapper')) {
            videoIframe = child.querySelector('iframe');
        } else {
            videoIframe = child.querySelector('figure.wp-block-embed.is-type-video iframe, div.wp-block-embed__wrapper iframe');
        }
        if (videoIframe && videoIframe.src && !pageData.videoUrlOnPage) {
            pageData.videoUrlOnPage = videoIframe.src;
        }

        // 3. Extract Mentioned Links (still global)
        if (child.tagName === 'P') {
            child.querySelectorAll('a[href]').forEach(a => {
                const linkHref = a.href;
                const linkText = a.innerText.trim();
                if (linkHref && !linkHref.startsWith(window.location.origin + '#') && linkText && !a.querySelector('img')) {
                    const linkAlreadyExists = pageData.mentionedLinks.some(l => l.href === linkHref && l.text === linkText);
                    if (!linkAlreadyExists) {
                        pageData.mentionedLinks.push({ text: linkText, href: linkHref });
                    }
                }
            });
        }
    });

    if (currentSection) { // Push the last section
        currentSection.text = currentSection.text.trim();
        pageData.sections.push(currentSection);
    }
    return pageData;
});
      combinedData = { ...combinedData, ...articleDetailData };

    } else {
      console.log("No valid article URL found in listing data, skipping article detail scraping.");
      // Update data to reflect that article page was not processed
        combinedData.articlePageTitle = 'N/A (no link to article page)';
        combinedData.textContent = ''; // Or specific message
        // sections, images, videoUrlOnPage, mentionedLinks will remain empty or as per initial combinedData
    }

    res.json(combinedData);

  } catch (err) {
    console.error("Error during Puppeteer script execution:", err.message);
    if (page && !res.headersSent) { // Check if page exists and response not already sent
        try {
            await page.screenshot({ path: 'error_runtime_screenshot.png', fullPage: true });
            console.log("📸 Screenshot taken on runtime error.");
        } catch (screenshotError) {
            console.error("Could not take screenshot on runtime error:", screenshotError.message);
        }
    }
    // Browser closing is now handled in finally
    if (!res.headersSent) {
        res.status(500).json({ error: err.message });
    }
  } finally {
    if (browser) { // More robust check
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

console.log("Step 5: starting server...");
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});