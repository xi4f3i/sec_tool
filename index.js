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
let count = 0;
async function parseReport(report) {
    const $ = cheerio.load(report);
    const is10KOld = report.includes('<type>10-K');
    const is10KNew = $('ix\\:nonnumeric').text().includes('10-K');
    const is20FOld = report.includes('<type>20-F');
    const is20FNew = $('ix\\:nonnumeric').text().includes('20-F');

    const docType =
        is20FOld || is20FNew ? '20-F' : is10KOld || is10KNew ? '10-K' : null;
    const docVersion = is10KNew || is20FNew ? 'New' : 'Old';

    // console.log(docType, docVersion);

    if (!docType) {
        throw new Error('Unknown document type');
    }

    let pharagraphs = {};

    if (docType === '10-K') {
        pharagraphs = {
            1: [],
            '1A': [],
            7: [],
        };
    } else if (docType === '20-F') {
        pharagraphs = {
            '4B': [],
            '3D': [],
            5: [],
        };
    }
    const allElements = $('*');
    let curItem = '';
    allElements.each((_, el) => {
        const element = $(el);
        const text = element
            .contents()
            .filter(function () {
                return this.type === 'text';
            })
            .text()
            .trim()
            .replaceAll('\n', ' ')
            .replaceAll('  ', ' ');

        if (docType === '10-K') {
            const match = text.match(/tem (\d+[A-Z]?)\.?\:?/);
            const match1 = text.match(/tem\s*\u00a0(\d+[A-Z]?)\.?\:?/);
            const match2 = text.match(/TEM\s*\u00a0(\d+[A-Z]?)\.?\:?/);
            const match3 = text.match(/TEM (\d+[A-Z]?)\.?\:?/);
            const match4 = text.match(/tem\n(\d+[A-Z]?)\.?\:?/);
            const match5 = text.match(/TEM\n(\d+[A-Z]?)\.?\:?/);
            const match6 = text.match(/m (\d+[A-Z]?)\.?/);
            if (text.length <= 30) {
                if (match) {
                    curItem = match[1];
                } else if (match1) {
                    curItem = match1[1];
                } else if (match2) {
                    curItem = match2[1];
                } else if (match3) {
                    curItem = match3[1];
                } else if (match4) {
                    curItem = match4[1];
                } else if (match5) {
                    curItem = match5[1];
                } else if (match6) {
                    curItem = match6[1];
                }
            }

            if (
                (curItem == '1' || curItem == '1A' || curItem == '7') &&
                filterpParagraphByWords(text)
            ) {
                pharagraphs[curItem].push(text);
            }
        } else if (docType === '20-F') {
            const match = text.match(/TEM (\d+[A-Z]?)\.?\:?/);
            const matchSubItem = text.match(/(\d+\d?)\.?\:?([A-Z])\.?\:?/);
            const match1 = text.match(/tem\s*\u00a0(\d+[A-Z]?)\.?\:?/);
            const match2 = text.match(/tem (\d+[A-Z]?)\.?\:?/);
            const match3 = text.match(/TEM\s*\u00a0(\d+[A-Z]?)\.?\:?/);
            const match4 = text.match(/tem\n(\d+[A-Z]?)\.?\:?/);
            const match5 = text.match(/TEM\n(\d+[A-Z]?)\.?\:?/);
            const match6 = text.match(/([A-Z])\./);
            const match7 = text.match(/I(\d+[A-Z]?)\./);
            if (text.length <= 50) {
                if (match) {
                    curItem = match[1];
                } else if (matchSubItem) {
                    curItem = `${matchSubItem[1]}${matchSubItem[2]}`;
                } else if (match1) {
                    curItem = match1[1];
                } else if (match2) {
                    curItem = match2[1];
                } else if (match3) {
                    curItem = match3[1];
                } else if (match4) {
                    curItem = match4[1];
                } else if (match5) {
                    curItem = match5[1];
                } else if (match6) {
                    if (!isNaN(Number(curItem))) {
                        curItem = curItem + match6[1];
                    } else if (curItem.length > 1) {
                        curItem =
                            curItem.slice(0, curItem.length - 1) + match6[1];
                    }
                } else if (match7) {
                    curItem = match7[1];
                }
            }

            if (
                (curItem === '4B' ||
                    curItem === '3D' ||
                    curItem.charAt(0) === '5') &&
                filterpParagraphByWords(text)
            ) {
                pharagraphs[curItem.charAt(0) === '5' ? '5' : curItem].push(
                    text
                );
            }
        }
    });

    const keys = Object.keys(pharagraphs);
    if (keys.every((key) => pharagraphs[key].length <= 0)) {
        throw new Error('empty pharagraphs');
    }

    return pharagraphs;
}

function filterpParagraphByWords(text) {
    if (text.length < 10) return false;
    text = text.toLowerCase();
    for (let word of words) {
        if (text.includes(word)) {
            return true;
        }
    }
    return false;
}

async function resolveEachYear() {
    const tickers = Object.keys(output);
    for (const ticker of tickers) {
        // console.log(`resolve ${ticker}`);
        const { cik, cikStr, years } = output[ticker];

        const cikJSON = await getCIKJSONByCIK(cikStr, ticker);
        cikData[ticker] = cikJSON;
        checkOrCreateDir(`./output/${ticker}/`);

        for (const year of [2014,2015,2016,2017,2018,2019,2020,2021,2022,2023]) {
            // console.log(`  -> resolve ${year}`);
            // const reportURL = getReportURL(cikJSON, cik, year);
            // if (!reportURL) {
            //     errors.noReportURL.push({
            //         ticker,
            //         year,
            //     });
            //     continue;
            // }
            // years[year].reportURL = reportURL;
            // console.log(`    -> reportURL: ${reportURL}`);

            let reportHTML;
            const reportHTMLPath = `./output/${ticker}/${year}.html`;
            if (
                await fs
                    .access(reportHTMLPath)
                    .then(() => true)
                    .catch(() => false)
            ) {
                // console.log(
                //     `      -> reportHTMLPath: ${reportHTMLPath} exists`
                // );
                count++;
                reportHTML = await fs.readFile(reportHTMLPath, 'utf-8');
            } else {
                continue;
                // try {
                //     reportHTML = await getReportHTML(reportURL);
                //     if (!reportHTML) {
                //         errors.noReportHTML.push({
                //             ticker,
                //             year,
                //             reportURL,
                //         });
                //         continue;
                //     }
                // } catch (error) {
                //     console.error(
                //         `      -> Failed to fetch report HTML from ${reportURL}:`,
                //         error.message
                //     );
                //     errors.noReportHTML.push({
                //         ticker,
                //         year,
                //         reportURL,
                //         err: error.message,
                //     });
                //     continue;
                // }

                // fs.writeFile(reportHTMLPath, reportHTML, 'utf-8');
            }

            try {
                const pharagraphs = await parseReport(reportHTML);

                const keys = Object.keys(pharagraphs);
                let words = 0;
                for (let key of keys) {
                    words += pharagraphs[key].reduce((p, c) => {
                        return p + c.split(' ').length + 1;
                    }, 0);
                }

                years[year].pharagraphs = pharagraphs;
                years[year].words = words;
                fs.writeFile(
                    `./output/${ticker}/${year}.json`,
                    JSON.stringify({
                        ...years[year],
                        pharagraphs,
                    }),
                    'utf-8'
                );
            } catch (error) {
                console.warn(
                    `-> Failed to resolve report HTML from:`,
                    error.message
                );
                errors.resolveAsHTML.push({
                    ticker,
                    year,
                    // reportURL,
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

let words = [];

async function initWords() {
    words = (await fs.readFile('./data/words.txt', 'utf-8')).split('\n');
    console.log(`words length: ${words.length}`);
    words = words.map((word) => word.trim());
}

async function entryPoint() {
    console.log('Start----------------------');
    console.log('1. initialize cik data & words');
    await initCIKData();
    await initWords();
    console.log('2. initialize output');
    initOutput();
    console.log('3. resolve each year');
    await resolveEachYear();
    console.log('4. save result');
    await saveResult();
    console.log('count: ', count);
    console.log('End----------------------');
}

entryPoint();
