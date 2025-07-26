import fs from 'fs/promises';

async function main() {
    const content = await fs.readFile('./output/output.json');
    const data = JSON.parse(content);

    const res = ['ticker, cik, year, pharagraph, word, content,'];

    const tickers = Object.keys(data);
    for (let ticker of tickers) {
        const years = Object.keys(data[ticker].years);

        for (let year of years) {
            const pharagraphs = Object.keys(
                data[ticker].years[year].pharagraphs ?? {}
            );
            for (let pharagraph of pharagraphs) {
                data[ticker].years[year].pharagraphs[pharagraph].forEach(
                    (p) => {
                        if (p.length > 0) {
                            res.push(
                                [
                                    ticker,
                                    data[ticker].cik,
                                    year,
                                    pharagraph,
                                    data[ticker].years[year].words,
                                    `"${p.replaceAll(',', '\,')}"`,
                                ].join(', ') + ','
                            );
                        }
                    }
                );
            }
        }
    }

    await fs.writeFile('./output.csv', res.join('\n'), 'utf-8');
}
main();
