import fs from 'fs/promises';

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

async function main() {
    const res = {
        ACLS: {},
        DIOD: {},
        INTC: {},
        KOPN: {},
        LSCC: {},
        MRVL: {},
    };
    const words = (await fs.readFile('./data/words.txt', 'utf-8'))
        .split('\n')
        .map((word) => word.trim());
    for (const fileName of fileNames) {
        res[fileName.split(' ')[0]][fileName.split(' ')[1]] = {};
        res[fileName.split(' ')[0]][fileName.split(' ')[1]].pharagraphs = (
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
        res[fileName.split(' ')[0]][fileName.split(' ')[1]].words = res[
            fileName.split(' ')[0]
        ][fileName.split(' ')[1]].pharagraphs.reduce((p, c) => {
            return p + c.split(' ').length + 1;
        }, 0);
    }

    await fs.writeFile('./2.json', JSON.stringify(res), 'utf-8');
    let csv = 'ticker, year, words,\n';
    for (const ticker of Object.keys(res)) {
        for (const year of Object.keys(res[ticker])) {
            csv += `${ticker}, ${year},${res[ticker][year].words},\n`;
        }
    }
    await fs.writeFile('./extra.csv', csv, 'utf-8');
}

main();
