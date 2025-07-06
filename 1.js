const old10KPath = './output/ACLS/2015.html';
const old20FPath = './output/HIMX/2016.html';
const new10KPath = './output/ACLS/2022.html';
const new20FPath = './output/HIMX/2022.html';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';

async function main() {
    const report = await fs.readFile(old10KPath, 'utf-8');
    const $ = cheerio.load(report);
    const is10KOld = $('type').text().includes('10-K');
    const is10KNew = $('ix\\:nonnumeric').text().includes('10-K');
    const is20FOld = $('type').text().includes('20-F');
    const is20FNew = $('ix\\:nonnumeric').text().includes('20-F');

    const docType =
        is20FOld || is20FNew ? '20-F' : is10KOld || is10KNew ? '10-K' : null;
    const docVersion = is10KNew || is20FNew ? 'New' : 'Old';

    console.log(docType, docVersion);

    if (!docType) {
        throw new Error('Unknown document type');
    }

    let pharagraphs = {};
    if (docVersion === 'New') {
        if (docType === '10-K') {
            pharagraphs = {
                1: [],
                '1A': [],
                7: [],
            };
            let curItem = '';
            let l = 0;
            $('body > div').each((i, el) => {
                const rootDivEl = $(el);
                if (rootDivEl.children().length <= 0) {
                    return;
                }

                if (rootDivEl.children().first()[0].tagName !== 'div') {
                    return;
                }

                rootDivEl
                    .children()
                    .first()
                    .children()
                    .each((j, ele) => {
                        if (
                            $(ele).first().children().first()?.[0]?.tagName ===
                                'b' &&
                            $(ele)
                                .first()
                                .children()
                                .first()
                                ?.text?.()
                                ?.includes?.('Item')
                        ) {
                            const match = $(ele)
                                .last()
                                .text()
                                .match(/(\d+[A-Z]?)\./);
                            if (match) {
                                curItem = match[1];
                                console.log(
                                    curItem,
                                    l + j,
                                    ele.tagName,
                                    ele.type
                                );
                            }
                        }

                        if (
                            (curItem === '1' ||
                                curItem === '1A' ||
                                curItem === '7') &&
                            $(ele).text().length > 0
                        ) {
                            pharagraphs[curItem].push($(ele).text());
                        }
                    });
                l += rootDivEl.children().first().children().length;
            });
            console.log(
                l,
                pharagraphs[1].length,
                pharagraphs['1A'].length,
                pharagraphs[7].length
            );
        } else {
            pharagraphs = {
                '4B': [],
                '3D': [],
                5: [],
            };
            let curItem = '';
            let l = 0;
            $('body > div').each((i, el) => {
                const rootDivEl = $(el);
                if (rootDivEl.children().length <= 0) {
                    return;
                }

                rootDivEl.children().each((i, el2) => {
                    $(el2)
                        .children()
                        .each((j, el3) => {
                            l++;
                            const ele3 = $(el3);
                            const textContent = ele3.text();
                            const matchItem =
                                textContent.match(/Item\s*\u00a0(\d+)\./);
                            const matchSubItem =
                                textContent.match(/(\d+\d?)\.([A-Z])\./);
                            if (
                                ele3[0].tagName === 'p' &&
                                ele3[0].attribs.style ===
                                    `font-family:'Times New Roman','Times','serif';font-size:10pt;font-weight:bold;margin:0pt 0pt 12pt 0pt;`
                            ) {
                                if (matchItem) {
                                    curItem = matchItem[1];
                                    console.log(
                                        curItem,
                                        l,
                                        ele3[0].tagName,
                                        ele3[0].type
                                    );
                                } else if (matchSubItem) {
                                    curItem = `${matchSubItem[1]}${matchSubItem[2]}`;
                                    console.log(
                                        curItem,
                                        l,
                                        ele3[0].tagName,
                                        ele3[0].type
                                    );
                                }
                            }

                            if (
                                (curItem === '4B' ||
                                    curItem === '3D' ||
                                    curItem.charAt(0) === '5') &&
                                textContent.length > 0
                            ) {
                                pharagraphs[
                                    curItem.charAt(0) === '5' ? '5' : curItem
                                ].push(textContent);
                            }
                        });
                });
            });
            console.log(
                l,
                pharagraphs['4B'].length,
                pharagraphs['3D'].length,
                pharagraphs[5].length
            );
        }
    } else {
        if (docType === '10-K') {
            const subElements = $('text').children();
            pharagraphs = {
                1: [],
                '1A': [],
                7: [],
            };
            let curItem = '';
            subElements.each((i, el) => {
                const textContent = $(el).text();
                const match = textContent.match(/Item\s*\u00a0(\d+[A-Z]?)\./);
                if (match) {
                    curItem = match[1];
                    console.log(curItem, i, el.tagName, el.type);
                }

                if (
                    (curItem === '1' || curItem === '1A' || curItem === '7') &&
                    textContent.length > 0
                ) {
                    pharagraphs[curItem].push(textContent);
                }
            });
            console.log(
                subElements.length,
                pharagraphs[1].length,
                pharagraphs['1A'].length,
                pharagraphs[7].length
            );
        } else {
            const subElements = $('text').children();
            pharagraphs = {
                '4B': [],
                '3D': [],
                5: [],
            };
            let curItem = '';
            subElements.each((i, el) => {
                const textContent = $(el).text();
                const matchItem = textContent.match(/ITEM (\d+\d?)\./);
                const matchSubItem = textContent.match(/(\d+\d?)\.([A-Z])\./);
                const isTitle = $($(el).children()?.[0])
                    ?.attr?.('name')
                    ?.startsWith?.('HTI_');
                if (matchItem && el.tagName === 'p' && isTitle) {
                    curItem = matchItem[1];
                    console.log(curItem, i, el.tagName, el.type);
                } else if (matchSubItem && el.tagName === 'p' && isTitle) {
                    curItem = `${matchSubItem[1]}${matchSubItem[2]}`;
                    console.log(curItem, i, el.tagName, el.type);
                }

                if (
                    (curItem === '4B' ||
                        curItem === '3D' ||
                        curItem.charAt(0) === '5') &&
                    textContent.length > 0
                ) {
                    pharagraphs[curItem.charAt(0) === '5' ? '5' : curItem].push(
                        textContent
                    );
                }
            });
            console.log(
                subElements.length,
                pharagraphs['4B'].length,
                pharagraphs['3D'].length,
                pharagraphs[5].length
            );
        }
    }

    fs.writeFile(
        `./${docType}_${docVersion}.json`,
        JSON.stringify(pharagraphs),
        'utf-8'
    );
}

main();
