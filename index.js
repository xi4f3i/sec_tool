import fs from 'fs/promises';
import { companies } from './data/company.js';
import { company_tickers_exchange } from './data/company_tickers_exchange.js';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

function getCIKByTicker(target_ticker) {
    const list = company_tickers_exchange.data;

    for (let item of list) {
        const [cik, _, ticker] = item;
        if (target_ticker === ticker) {
            const cikStr = String(cik).padStart(10, '0');
            return { cik, cikStr };
        }
    }

    return {};
}

async function getCIKJSONByCIK(cik, ticker) {
    const tickers = Object.keys(cikData);
    if (tickers.length > 0 && ticker in cikData) {
        return cikData[ticker];
    }

    const resp = await fetch(
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        {
            headers: {
                accept: '*/*',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7',
                priority: 'u=1, i',
                'sec-ch-ua':
                    '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Linux"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                Referer: 'https://www.sec.gov/',
            },
            body: null,
            method: 'GET',
        }
    );
    const res = await resp.json();

    try {
        const resp01 = await fetch(
            `https://data.sec.gov/submissions/CIK${cik}-submissions-001.json`,
            {
                headers: {
                    accept: '*/*',
                    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7',
                    priority: 'u=1, i',
                    'sec-ch-ua':
                        '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Linux"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site',
                    Referer: 'https://www.sec.gov/',
                },
                body: null,
                method: 'GET',
            }
        );

        const res01 = await resp01.json();
        Object.keys(res01).forEach((key) => {
            res.filings.recent[key] = res.filings.recent[key].concat(
                res01[key]
            );
        });
    } catch (err) {
        console.warn(
            `Failed to fetch https://data.sec.gov/submissions/CIK${cik}-submissions-001.json`
        );
    }

    return res;
}

function initOutput() {
    for (const company of companies) {
        const { ticker, year } = company;

        const { cik, cikStr } = getCIKByTicker(ticker);

        if (!cik || !cikStr) {
            errors.noCikOrCikStr.push({
                ticker,
                year,
            });
            return;
        }

        const item = output[ticker] ?? {
            ticker: ticker,
            cik: cik,
            cikStr: cikStr,
            years: {},
        };

        item.years[year] = {
            sentences: [],
            reportURL: null,
        };

        output[ticker] = item;
    }
}

const output = {};

let cikData = {};

const errors = {
    noCikOrCikStr: [],
    noReportURL: [],
    noReportHTML: [],
    resolveAsHTML: [],
};

async function saveResult() {
    checkOrCreateDir(`./output/`);
    fs.writeFile('./output/output.json', JSON.stringify(output), 'utf-8');
    fs.writeFile('./output/cik_data.json', JSON.stringify(cikData), 'utf-8');
    fs.writeFile('./output/errors.json', JSON.stringify(errors), 'utf-8');
}

function getReportURL(cikJSON, cik, year) {
    const { form, reportDate, primaryDocument, accessionNumber } =
        cikJSON.filings.recent;

    for (let idx = 0; idx < form.length; idx++) {
        if (form[idx] !== '10-K' && form[idx] !== '20-F') {
            continue;
        }
        const date = new Date(reportDate[idx]);

        if (date.getFullYear() !== Number(year)) {
            continue;
        }

        return `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber[idx].replaceAll('-', '')}/${primaryDocument[idx]}`;
    }

    return void 0;
}

async function getReportHTML(reportURL) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
        ],
    });
    try {
        await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 600 + 200)
        );

        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        await page.setExtraHTTPHeaders({
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7',
            'Cache-Control': 'max-age=0',
            Pragma: 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
        });

        await page.goto(reportURL, {
            waitUntil: 'networkidle2',
            timeout: 10000,
        });

        const html = await page.content();
        return html;
    } catch (err) {
        throw err;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function checkOrCreateDir(dir) {
    try {
        await fs.access(dir);
    } catch (error) {
        await fs.mkdir(dir, { recursive: true });
    }
}

async function resolveReport(reportHTML) {
    const $ = cheerio.load(reportHTML);
    const is10KOld = $('type').text().includes('10-K');
    const is10KNew = $('ix\\:nonnumeric').text().includes('10-K');
    const is20FOld = $('type').text().includes('20-F');
    const is20FNew = $('ix\\:nonnumeric').text().includes('20-F');

    const docType =
        is10KOld || is10KNew ? '10-K' : is20FOld || is20FNew ? '20-F' : null;
    const docVersion = is10KNew || is20FNew ? 'New' : 'Old';

    console.log(docType, docVersion);

    if (!docType) {
        throw new Error('Unknown document type');
    }

    if (docVersion === 'New') {
        if (docType === '10-K') {
        } else {
        }
    } else {
        if (docType === '10-K') {
            $('text p').each((index, element) => {
                const text = $(element).text();
                console.log(text);
            });
        } else {
        }
    }

    return [];
}

async function resolveEachYear() {
    const tickers = Object.keys(output);
    for (const ticker of tickers) {
        console.log(`resolve ${ticker}`);
        const { cik, cikStr, years } = output[ticker];

        const cikJSON = await getCIKJSONByCIK(cikStr, ticker);
        cikData[ticker] = cikJSON;
        checkOrCreateDir(`./output/${ticker}/`);

        for (const year of Object.keys(years)) {
            console.log(`  -> resolve ${year}`);
            const reportURL = getReportURL(cikJSON, cik, year);
            if (!reportURL) {
                errors.noReportURL.push({
                    ticker,
                    year,
                });
                continue;
            }
            years[year].reportURL = reportURL;
            console.log(`    -> reportURL: ${reportURL}`);

            let reportHTML;
            const reportHTMLPath = `./output/${ticker}/${year}.html`;
            if (
                await fs
                    .access(reportHTMLPath)
                    .then(() => true)
                    .catch(() => false)
            ) {
                console.log(
                    `      -> reportHTMLPath: ${reportHTMLPath} exists`
                );
                reportHTML = await fs.readFile(reportHTMLPath, 'utf-8');
            } else {
                try {
                    reportHTML = await getReportHTML(reportURL);
                    if (!reportHTML) {
                        errors.noReportHTML.push({
                            ticker,
                            year,
                            reportURL,
                        });
                        continue;
                    }
                } catch (error) {
                    console.error(
                        `      -> Failed to fetch report HTML from ${reportURL}:`,
                        error.message
                    );
                    errors.noReportHTML.push({
                        ticker,
                        year,
                        reportURL,
                        err: error.message,
                    });
                    continue;
                }

                fs.writeFile(reportHTMLPath, reportHTML, 'utf-8');
            }

            try {
                const sentences = await resolveReport(reportHTML);
                years[year].sentences = sentences;
            } catch (error) {
                console.warn(
                    `      -> Failed to resolve report HTML from ${reportURL}:`,
                    error.message
                );
                errors.resolveAsHTML.push({
                    ticker,
                    year,
                    reportURL,
                    reportHTMLPath,
                    err: error.message,
                });
            }
        }
    }
}

async function initCIKData() {
    try {
        cikData = JSON.parse(
            await fs.readFile('./output/cik_data.json', 'utf-8')
        );
    } catch (err) {
        console.warn('Failed to read ./output/cik_data.json');
        console.warn(err.message);
    }
}

async function entryPoint() {
    console.log('Start----------------------');
    console.log('1. initialize cik data');
    await initCIKData();
    console.log('2. initialize output');
    initOutput();
    console.log('3. resolve each year');
    await resolveEachYear();
    console.log('4. save result');
    await saveResult();
    console.log('End----------------------');
}

entryPoint();
