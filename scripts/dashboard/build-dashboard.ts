import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { graphql } from '@octokit/graphql';
import { Queries } from './issue-queries';

interface Discussion {
    id: string;
    __typename: string;
    title: string;
    author?: { login: string };
    reactions: { totalCount: number };
    comments: {
        totalCount: number;
        nodes: Array<{ reactions: { totalCount: number } }>;
        pageInfo: { hasNextPage: boolean };
    };
    reviews: {
        totalCount: number;
        nodes: Array<{ comments: { totalCount: number } }>;
    };
    resourcePath: string;
    repository: { name: string };
    labels?: { nodes: Array<{ name: string }> };
    assignees: { totalCount: number };
    timelineItems: { updatedAt: string };
}

interface HotDiscussion {
    id: string;
    isPR: boolean;
    isAssigned: boolean;
    title: string;
    author: string;
    resourcePath: string;
    repo: string;
    labels: Array<{ name: string }>;
    score: number;
}

interface RateLimit {
    cost: number;
    limit: number;
    remaining: number;
    resetAt: string;
}

interface PageInfo {
    hasNextPage: boolean;
    endCursor: string;
}

interface DiscussionNode {
    id: string;
    title: string;
}

interface SearchResult {
    nodes: DiscussionNode[];
    pageInfo: PageInfo;
}

interface GraphQLResponse {
    rateLimit: RateLimit;
    search: SearchResult;
}


async function getHotDiscussions(discussions: Discussion[]): Promise<any[]> {
    const result: HotDiscussion[] = await Promise.all(
        discussions.map(async (discussion) => {
            try {
                const isPR = discussion.__typename === 'PullRequest';
                if (discussion.comments.pageInfo.hasNextPage) {
                    const fetchedDiscussion = await getDiscussionByID(isPR, discussion.id);
                    discussion = fetchedDiscussion.node;
                }

                const interactionsCount =
                    discussion.reactions.totalCount +
                    discussion.comments.totalCount +
                    discussion.comments.nodes.reduce(
                        (acc, curr) => acc + curr.reactions.totalCount,
                        0
                    );

                const finalInteractionsCount = isPR
                    ? interactionsCount +
                    discussion.reviews.totalCount +
                    discussion.reviews.nodes.reduce(
                        (acc, curr) => acc + curr.comments.totalCount,
                        0
                    )
                    : interactionsCount;

                return {
                    id: discussion.id,
                    isPR,
                    isAssigned: !!discussion.assignees.totalCount,
                    title: discussion.title,
                    author: discussion.author ? discussion.author.login : '',
                    resourcePath: discussion.resourcePath,
                    repo: 'asyncapi/' + discussion.repository.name,
                    labels: discussion.labels ? discussion.labels.nodes : [],
                    score:
                        finalInteractionsCount /
                        Math.pow(monthsSince(discussion.timelineItems.updatedAt) + 2, 1.8),
                };
            } catch (e) {
                console.error(
                    `there were some issues while parsing this item: ${JSON.stringify(
                        discussion
                    )}`
                );
                throw e;
            }
        })
    );
    result.sort((ElemA, ElemB) => ElemB.score - ElemA.score);
    const filteredResult = result.filter(issue => issue.author !== 'asyncapi-bot');
    return filteredResult.slice(0, 12);
}

async function writeToFile(content: object): Promise<void> {
    writeFileSync(
        resolve(__dirname, '..', '..', 'dashboard.json'),
        JSON.stringify(content, null, '  ')
    );
}

interface IssueLabel {
    name: string;
}

interface GoodFirstIssue {
    id: string;
    title: string;
    isAssigned: boolean;
    resourcePath: string;
    repo: string;
    author: string;
    area: string;
    labels: IssueLabel[];
}

interface Issue {
    id: string;
    title: string;
    assignees: { totalCount: number };
    resourcePath: string;
    repository: { name: string };
    author: { login: string };
    labels: { nodes: IssueLabel[] };
}

async function mapGoodFirstIssues(issues: Issue[]): Promise<GoodFirstIssue[]> {
    return issues.map((issue) => ({
        id: issue.id,
        title: issue.title,
        isAssigned: !!issue.assignees.totalCount,
        resourcePath: issue.resourcePath,
        repo: 'asyncapi/' + issue.repository.name,
        author: issue.author.login,
        area: getLabel(issue, 'area/') || 'Unknown',
        labels: issue.labels.nodes.filter(
            (label) =>
                !label.name.startsWith('area/') &&
                !label.name.startsWith('good first issue')
        ),
    }));
}

function getLabel(issue: any, filter: string): string | undefined {
    const result = issue.labels.nodes.find((label: IssueLabel) =>
        label.name.startsWith(filter)
    );
    return result && result.name.split('/')[1];
}

function monthsSince(date: string): number {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    // 2592000 = number of seconds in a month = 30 * 24 * 60 * 60
    const months = seconds / 2592000;
    return Math.floor(months);
}

async function getDiscussions(query: string, pageSize: number, endCursor: string | null = null): Promise<any[]> {
    try {
        let result = await graphql<GraphQLResponse>(query, {
            first: pageSize,
            after: endCursor,
            headers: {
                authorization: `token ${process.env.GITHUB_TOKEN}`,
            },
        });

        if (result.rateLimit.remaining <= 100) {
            console.log(
                `[WARNING] GitHub GraphQL rateLimit`,
                `cost = ${result.rateLimit.cost}`,
                `limit = ${result.rateLimit.limit}`,
                `remaining = ${result.rateLimit.remaining}`,
                `resetAt = ${result.rateLimit.resetAt}`
            );
        }

        const hasNextPage = result.search.pageInfo.hasNextPage;

        if (!hasNextPage) {
            return result.search.nodes;
        } else {
            return result.search.nodes.concat(
                await getDiscussions(query, pageSize, result.search.pageInfo.endCursor)
            );
        }
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function getDiscussionByID(isPR: boolean, id: string): Promise<any> {
    try {
        let result = await graphql(isPR ? Queries.pullRequestById : Queries.issueById, {
            id,
            headers: {
                authorization: `token ${process.env.GITHUB_TOKEN}`,
            },
        });
        return result;
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function start(): Promise<void> {
    try {
        const [issues, PRs, rawGoodFirstIssues] = await Promise.all([
            getDiscussions(Queries.hotDiscussionsIssues, 20),
            getDiscussions(Queries.hotDiscussionsPullRequests, 20),
            getDiscussions(Queries.goodFirstIssues, 20),
        ]);
        const discussions = issues.concat(PRs);
        const [hotDiscussions, goodFirstIssues] = await Promise.all([
            getHotDiscussions(discussions),
            mapGoodFirstIssues(rawGoodFirstIssues),
        ]);
        await writeToFile({ hotDiscussions, goodFirstIssues });
    } catch (e) {
        console.log('There were some issues parsing data from github.');
        console.log(e);
    }
}

start();

export { getLabel, monthsSince, mapGoodFirstIssues, getHotDiscussions, getDiscussionByID };
