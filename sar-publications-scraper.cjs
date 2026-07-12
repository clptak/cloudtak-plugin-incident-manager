#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Manual scraper for SAR publications from arizonasar.com and saraz.org
 * Run locally: npm install puppeteer, then node sar-publications-scraper.js
 * Outputs normalized JSON to ~/dev/cloudtak-plugin-incident-manager/publications.json
 */

const SOURCES = [
  {
    name: 'arizonasar.com',
    url: 'https://arizonasar.com/publications/',
    parser: 'parseArizonaSAR'
  },
  {
    name: 'saraz.org',
    url: 'https://www.saraz.org/SARAZNew/documents.html',
    parser: 'parseSARAZ'
  }
];

const OUTPUT_FILE = path.join(process.env.HOME, 'dev/cloudtak-plugin-incident-manager/publications.json');

/**
 * Parse date string from description, return ISO string
 * Handles formats like "9/7/2023", "September 11, 2024", "2021", etc.
 */
function parseDate(text) {
  if (!text) return null;

  // Try MM/DD/YYYY
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Try Month DD, YYYY
  const monthMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (monthMatch) {
    const months = { 'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6, 'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12 };
    const [, monthName, day, year] = monthMatch;
    const monthNum = months[monthName.toLowerCase()];
    return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Try just YYYY
  const yearMatch = text.match(/(\d{4})/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  return null;
}

/**
 * Parse edition from text
 * Handles "5th edition", "18th Edition", "2nd Edition", etc.
 */
function parseEdition(text) {
  if (!text) return null;
  const match = text.match(/(\d+)(?:st|nd|rd|th)\s+edition/i);
  if (match) {
    const num = match[1];
    const ones = num % 10;
    const tens = Math.floor(num / 10) % 10;
    
    if (tens === 1) return `${num}th`;
    if (ones === 1) return `${num}st`;
    if (ones === 2) return `${num}nd`;
    if (ones === 3) return `${num}rd`;
    return `${num}th`;
  }
  return null;
}

/**
 * Generate ID from title
 */
function generateId(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

/**
 * Determine file format from URL
 */
function getFormat(url) {
  if (url.includes('.pdf')) return 'PDF';
  if (url.includes('.docx') || url.includes('.doc')) return 'DOCX';
  if (url.includes('.zip')) return 'ZIP';
  if (url.includes('.pptx') || url.includes('.ppt')) return 'PPTX';
  return 'PDF';
}

/**
 * Parse arizonasar.com publications using page DOM
 */
async function parseArizonaSAR(page) {
  return await page.evaluate(() => {
    const publications = [];
    const headings = document.querySelectorAll('h3.wp-block-heading');

    for (const heading of headings) {
      const title = heading.textContent.trim();
      
      // Find next paragraph with link
      let p = heading.nextElementSibling;
      while (p && p.tagName !== 'P') {
        p = p.nextElementSibling;
      }
      
      if (!p) continue;

      const link = p.querySelector('a');
      if (!link) continue;

      const url = link.href;
      const pText = p.textContent;
      
      // Build description: text after link, max 300 chars
      let description = pText
        .replace(/Download\s+/, '')
        .trim()
        .substring(0, 300);

      publications.push({
        title: title,
        url: url,
        description: description,
        fullText: pText
      });
    }

    return publications;
  });
}

/**
 * Parse saraz.org publications using page DOM
 */
async function parseSARAZ(page) {
  return await page.evaluate(() => {
    const publications = [];
    const rows = document.querySelectorAll('div.Row.white');

    for (const row of rows) {
      const cells = row.querySelectorAll('div.Cell');
      if (cells.length < 2) continue;

      const linkElem = cells[0].querySelector('a');
      if (!linkElem) continue;

      const title = linkElem.textContent.trim();
      const url = linkElem.href;
      const description = cells[1].textContent.trim().substring(0, 300);
      const fullText = cells[1].textContent;

      publications.push({
        title: title,
        url: url,
        description: description,
        fullText: fullText
      });
    }

    return publications;
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('Manual SAR Publications Scraper');
  console.log('Starting Puppeteer...\n');

  const browser = await puppeteer.launch();
  let allPublications = [];

  try {
    for (const source of SOURCES) {
      console.log(`Fetching ${source.name}...`);
      const page = await browser.newPage();
      page.setDefaultTimeout(15000);

      try {
        await page.goto(source.url, { waitUntil: 'networkidle2' });
        console.log(`Parsing ${source.name}...`);

        const parser = source.parser === 'parseArizonaSAR' ? parseArizonaSAR : parseSARAZ;
        const rawPublications = await parser(page);

        console.log(`Found ${rawPublications.length} publications\n`);

        // Normalize each publication
        const normalized = rawPublications.map(pub => ({
          id: generateId(pub.title),
          title: pub.title,
          url: pub.url,
          format: getFormat(pub.url),
          description: pub.description,
          authors: ['Arizona Search and Rescue Coordinators Association'],
          publicationDate: parseDate(pub.fullText),
          edition: parseEdition(pub.fullText),
          source: source.name
        }));

        allPublications = allPublications.concat(normalized);
      } catch (err) {
        console.error(`Error processing ${source.name}: ${err.message}\n`);
      } finally {
        await page.close();
      }
    }

    // Deduplicate by title + author
    const seen = new Set();
    const deduped = allPublications.filter(pub => {
      const key = `${pub.title}|${pub.authors.join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by publication date (newest first), nulls last
    deduped.sort((a, b) => {
      if (!a.publicationDate && !b.publicationDate) return 0;
      if (!a.publicationDate) return 1;
      if (!b.publicationDate) return -1;
      return new Date(b.publicationDate) - new Date(a.publicationDate);
    });

    // Write output
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(deduped, null, 2));
    console.log(`✓ Wrote ${deduped.length} publications to:`);
    console.log(`  ${OUTPUT_FILE}\n`);
    console.log('Next steps:');
    console.log('1. Review publications.json for accuracy');
    console.log('2. Commit to your plugin repo');
    console.log('3. Update manually as new publications appear');

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
