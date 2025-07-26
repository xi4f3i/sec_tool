import fs from 'fs/promises';
import * as cheerio from 'cheerio';

let words = [];
parseReport('./output/DIOD/2021.html');
export async function parseReport(reportPath) {
    words = (await fs.readFile('./data/words.txt', 'utf-8')).split('\n');
    const report = await fs.readFile(reportPath, 'utf-8');
    const $ = cheerio.load(report);
    const is10KOld = report.includes('<type>10-K');
    const is10KNew = $('ix\\:nonnumeric').text().includes('10-K');
    const is20FOld = report.includes('<type>20-F');
    const is20FNew = $('ix\\:nonnumeric').text().includes('20-F');

    const docType =
        is20FOld || is20FNew ? '20-F' : is10KOld || is10KNew ? '10-K' : null;
    const docVersion = is10KNew || is20FNew ? 'New' : 'Old';

    console.log(docType, docVersion);

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

            if (curItem == '1' || curItem == '1A' || curItem == '7') {
                if (filterpParagraphByWords(text)) {
                    pharagraphs[curItem].push(text);
                }
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
                        console.log(curItem, text);
                    } else if (curItem.length > 1) {
                        curItem =
                            curItem.slice(0, curItem.length - 1) + match6[1];
                        console.log(curItem, text);
                    }
                } else if (match7) {
                    curItem = match7[1];
                    console.log(curItem, text);
                }
            }

            if (
                curItem === '4B' ||
                curItem === '3D' ||
                curItem.charAt(0) === '5'
            ) {
                if (filterpParagraphByWords(text)) {
                    pharagraphs[curItem.charAt(0) === '5' ? '5' : curItem].push(
                        text
                    );
                }
            }
        }
    });

    await fs.writeFile('./1.json', JSON.stringify(pharagraphs));

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
        if (text.includes(word.trim())) {
            return true;
        }
    }
    // console.log(text.includes('research and development'));
    return false;
}
