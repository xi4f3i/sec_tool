import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import { syllable } from 'syllable';
import nlp from 'compromise';
import { forewardWords } from './data/foreward_looking.js';

const words = [];
const positiveWords = [];
const negativeWords = [];
const _forewardWords = new Set(forewardWords);
async function initWords() {
    (await fs.readFile('./data/words.txt', 'utf-8'))
        .split('\n')
        .forEach((word) => words.push(word.trim().toLowerCase()));

    (await fs.readFile('./data/emotion.csv', 'utf-8'))
        .split('\n')
        .slice(1)
        .forEach((cur) => {
            const [word, ident] = cur.split(',');
            if (ident.trim() === 'Positive') {
                positiveWords.push(word.trim().toLowerCase());
            } else if (ident.trim() === 'Negative') {
                negativeWords.push(word.trim().toLowerCase());
            } else {
                console.warn(`parse positive or negative word failed: ${cur}`);
            }
        });
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

    let pharagraphs = [];

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
                pharagraphs.push(text);
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
                pharagraphs.push(text);
            }
        }
    });

    return pharagraphs;
}

const fileNames = [
    'ACLS 2014.txt',
    'ACLS 2020.txt',
    'ACLS 2021.txt',
    'ACLS 2022.txt',
    'ACLS 2023.txt',
    'DIOD 2014.txt',
    'INTC 2017.txt',
    'INTC 2018.txt',
    'INTC 2019.txt',
    'INTC 2020.txt',
    'INTC 2021.txt',
    'INTC 2022.txt',
    'INTC 2023.txt',
    'KOPN 2023.txt',
    'LSCC 2015.txt',
    'MRVL 2014.txt',
    'MRVL 2015.txt',
    'MRVL 2016.txt',
    'MRVL 2017.txt',
    'MRVL 2018.txt',
];

/**
 * @param {Array<string>} pharagraphs
 * @returns {number} fogIndex
 */
function calcFogIndexAndForewardSentences(pharagraphs) {
    let totalSentences = 0;
    let totalWords = 0;
    let complexWords = 0;
    let forewardSentences = 0;

    for (const pharagraph of pharagraphs) {
        const doc = nlp(pharagraph);
        totalSentences += doc.sentences().length;
        totalWords += doc.wordCount();

        const words = doc.terms().out('array');
        words.forEach((word) => {
            if (syllable(word) >= 3) {
                complexWords++;
            }
        });

        doc.sentences()
            .out('array')
            .forEach((sentence) => {
                const _words = sentence
                    .toLowerCase()
                    .split(/\W+/)
                    .filter(Boolean);
                for (const _word of _words) {
                    if (_forewardWords.has(_word)) {
                        forewardSentences++;
                        break;
                    }
                }
            });
    }

    if (totalSentences === 0 || totalWords === 0) {
        return 0;
    }

    const avgWordsPerSentence = totalWords / totalSentences;
    const percentComplexWords = (complexWords / totalWords) * 100;

    const fogIndex = 0.4 * (avgWordsPerSentence + percentComplexWords);

    return {
        fogIndex: parseFloat(fogIndex.toFixed(2)),
        forewardSentences: forewardSentences,
    };
}

async function main() {
    await initWords();
    const entries = await fs.readdir('./output', {
        withFileTypes: true,
    });
    const tickers = entries
        .map((entry) => {
            if (entry.isDirectory()) {
                return entry.name;
            }

            return null;
        })
        .filter((i) => !!i);

    let res =
        'ticker, year, for_index,positive_words,negative_words,foreward_sentences,\n';
    for (const ticker of tickers) {
        for (let year = 2014; year <= 2023; year++) {
            let line = `${ticker},${year},`;
            let reportHTML = '';
            try {
                const filePath = `./output/${ticker}/${year}.html`;
                reportHTML = await fs.readFile(filePath, 'utf-8');
            } catch (err) {
                console.log(
                    `${ticker}/${year}.html read failed: ` + err.message
                );
                // do nothing
                continue;
            }
            let pharagraphs = [];
            try {
                pharagraphs = await parseReport(reportHTML);
            } catch (err) {
                console.log(
                    `${ticker}/${year}.html parse failed: ` + err.message
                );
                continue;
            }
            const { fogIndex, forewardSentences } =
                calcFogIndexAndForewardSentences(pharagraphs);
            line += `${fogIndex},`;
            const { p, n } = pharagraphs.reduce(
                (prev, cur) => {
                    cur.toLowerCase()
                        .split(/\W+/)
                        .filter(Boolean)
                        .forEach((word) => {
                            if (positiveWords.includes(word)) {
                                prev.p++;
                            }
                            if (negativeWords.includes(word)) {
                                prev.n++;
                            }
                        });

                    return prev;
                },
                { p: 0, n: 0 }
            );

            line += `${p},${n},${forewardSentences},\n`;

            res += line;
        }
    }

    for (const fileName of fileNames) {
        const ticker = fileName.split(' ')[0];
        const year = fileName.split(' ')[1];
        let line = `${ticker},${year},`;
        const pharagraphs = (
            await fs.readFile(`./missing document/${fileName}`, 'utf-8')
        )
            .split('\n')
            .map((i) => i.trim())
            .filter((i) => i.length >= 10)
            .filter((text) => {
                text = text.toLowerCase();
                for (let word of words) {
                    if (text.includes(word)) {
                        return true;
                    }
                }
                return false;
            });

        const { fogIndex, forewardSentences } =
            calcFogIndexAndForewardSentences(pharagraphs);
        line += `${fogIndex},`;
        const { p, n } = pharagraphs.reduce(
            (prev, cur) => {
                cur.toLowerCase()
                    .split(/\W+/)
                    .filter(Boolean)
                    .forEach((word) => {
                        if (positiveWords.includes(word)) {
                            prev.p++;
                        }
                        if (negativeWords.includes(word)) {
                            prev.n++;
                        }
                    });

                return prev;
            },
            { p: 0, n: 0 }
        );
        line += `${p},${n},${forewardSentences},\n`;

        res += line;
    }

    await fs.writeFile('./output/calc.csv', res, 'utf-8');
}

main();
