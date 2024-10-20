import { resolve } from 'path';
import fs from 'fs';
import rssFeed from './build-rss';
import buildPostList from './build-post-list';
import buildCaseStudiesList from './casestudies';
import buildAdoptersList from './adopters';
import buildFinanceInfoList from './finance';

interface FinanceInfoParams {
    currentDir: string;
    configDir: string;
    financeDir: string;
    year: string;
    jsonDataDir: string;
}

async function start(): Promise<void> {
    await buildPostList();
    rssFeed(
        'blog',
        'AsyncAPI Initiative Blog RSS Feed',
        'AsyncAPI Initiative Blog',
        'rss.xml'
    );
    await buildCaseStudiesList(
        'config/casestudies',
        resolve(__dirname, '../config', 'case-studies.json')
    );
    await buildAdoptersList();

    const financeDir = resolve('.', 'config', 'finance');

    // Loop through all the files in the finance directory and find the latest year to build the finance info list
    const yearsList: string[] = fs.readdirSync(financeDir)
        // Filter out any files that are not numbers
        .filter((file: string) => {
            return !Number.isNaN(parseFloat(file));
        })
        // Sort the years in descending order
        .sort((a: string, b: string) => {
            return parseFloat(b) - parseFloat(a);
        });

    if (yearsList.length === 0) {
        throw new Error('No finance data found in the finance directory.');
    }

    const latestYear = yearsList[0];

    await buildFinanceInfoList({
        currentDir: '.',
        configDir: 'config',
        financeDir: 'finance',
        year: latestYear,
        jsonDataDir: 'json-data'
    });
}

export default start;

start();
