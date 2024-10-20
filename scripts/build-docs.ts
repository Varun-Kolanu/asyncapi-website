import { sortBy } from 'lodash';

interface NavItem {
    title: string;
    weight: number;
    isRootElement?: boolean;
    isRootSection?: boolean;
    isSection?: boolean;
    rootSectionId?: string;
    sectionWeight?: number;
    slug?: string;
    parent?: string;
    sectionId?: string;
    isPrerelease?: boolean;
    href?: string;
}

interface TreeNode {
    item: NavItem;
    children: { [key: string]: TreeNode };
}

interface DocPost {
    title: string;
    slug: string;
    isRootElement?: boolean;
    isRootSection?: boolean;
    isSection?: boolean;
    href?: string;
    nextPage?: { title: string; href: string };
    prevPage?: { title: string; href: string };
}

type DocTree = { [key: string]: TreeNode };

export function buildNavTree(navItems: NavItem[]): DocTree {
    try {
        const tree: DocTree = {
            'welcome': {
                item: { title: 'Welcome', weight: 0, isRootSection: true, isSection: true, rootSectionId: 'welcome', sectionWeight: 0, slug: '/docs' },
                children: {}
            }
        };

        // First we make sure that list of items lists main section items and then sub sections, documents last
        const sortedItems = sortBy(navItems, ['isRootSection', 'weight', 'isSection']);

        sortedItems.forEach(item => {
            if (item.isRootSection) {
                tree[item.rootSectionId!] = { item, children: {} };
            }

            if (item.parent) {
                if (!tree[item.parent]) {
                    throw new Error(`Parent section ${item.parent} not found for item ${item.title}`);
                }
                tree[item.parent].children[item.sectionId!] = { item, children: {} };
            }

            if (!item.isSection) {
                if (item.sectionId) {
                    let section = tree[item.rootSectionId!]?.children[item.sectionId] as TreeNode;
                    if (!section) {
                        tree[item.rootSectionId!].children[item.sectionId] = { item, children: {} };
                    }
                    tree[item.rootSectionId!].children[item.sectionId!].children[item.title] = { item, children: {} };
                } else {
                    tree[item.rootSectionId!].children[item.title] = { item, children: {} };
                }
            }
        });

        for (const [rootKey, rootValue] of Object.entries(tree)) {
            const allChildren = rootValue.children;
            const allChildrenKeys = Object.keys(allChildren);

            rootValue.children = allChildrenKeys
                .sort((prev, next) => {
                    return (allChildren[prev] as TreeNode).item.weight - (allChildren[next] as TreeNode).item.weight;
                })
                .reduce((obj, key) => {
                    obj[key] = allChildren[key];
                    return obj;
                }, {} as { [key: string]: TreeNode });

            // Handling subsections
            if (allChildrenKeys.length > 1) {
                for (const key of allChildrenKeys) {
                    const childNode = allChildren[key];
                    if (childNode.children) {
                        childNode.children = Object.values(childNode.children).sort((prev, next) => {
                            return prev.item.weight - next.item.weight;
                        }).reduce((acc: { [key: string]: TreeNode }, current) => {
                            acc[current.item.title] = current;
                            return acc;
                        }, {});
                    }

                    // Point in slug for specification subgroup to the latest specification version
                    if (rootKey === 'reference' && key === 'specification') {
                        childNode.item.href = Object.values(childNode.children).find(c => c.item.isPrerelease === undefined)?.item.slug;
                    }
                }
            }
        }

        return tree;

    } catch (err) {
        throw new Error(`Failed to build navigation tree: ${(err as Error).message}`);
    }
}

// Recursion function to convert DocPosts
export function convertDocPosts(docObject: TreeNode | NavItem): DocPost[] {
    try {
        let docsArray: DocPost[] = [];
        if ('item' in docObject && docObject.item.slug) {
            docsArray.push(docObject.item as DocPost);
        } else {
            const navItem = docObject as NavItem;
            if (navItem.slug) {
                docsArray.push(navItem as DocPost);
            }
        }

        if ('children' in docObject && docObject.children) {
            const children = docObject.children;
            Object.keys(children).forEach((child) => {
                const docChildArray = convertDocPosts(children[child]);
                docsArray = [...docsArray, ...docChildArray];
            });
        }
        return docsArray;
    } catch (err) {
        throw new Error(`Error in convertDocPosts: ${(err as Error).message}`);
    }
}

// Function to add doc buttons (next/prev) to doc posts
export function addDocButtons(docPosts: DocPost[], treePosts: DocTree): DocPost[] {
    let structuredPosts: DocPost[] = [];
    let rootSections: string[] = [];

    try {
        Object.keys(treePosts).forEach((rootElement) => {
            structuredPosts.push(treePosts[rootElement].item as DocPost);
            if (treePosts[rootElement].children) {
                let children = treePosts[rootElement].children;
                Object.keys(children).forEach((child) => {
                    let docChildArray = convertDocPosts(children[child] as TreeNode);
                    structuredPosts = [...structuredPosts, ...docChildArray];
                });
            }
        });

        const welcomePage = docPosts.filter(p => p.slug === '/docs');
        if (welcomePage) {
            structuredPosts[0] = welcomePage[0];
        }

        let countDocPages = structuredPosts.length;
        structuredPosts = structuredPosts.map((post, index) => {
            if (post?.isRootSection || post?.isSection || index === 0) {
                if (post?.isRootSection || index === 0) rootSections.push(post.title);
                return post;
            }

            let nextPage: Partial<DocPost> = {}, prevPage: Partial<DocPost> = {};
            let docPost = post;

            if (index + 1 < countDocPages) {
                if (!structuredPosts[index + 1].isRootElement && !structuredPosts[index + 1].isSection) {
                    nextPage = {
                        title: structuredPosts[index + 1].title,
                        href: structuredPosts[index + 1].slug
                    };
                } else if (index + 2 < countDocPages) {
                    nextPage = {
                        title: `${structuredPosts[index + 1].title} - ${structuredPosts[index + 2].title}`,
                        href: structuredPosts[index + 2].slug
                    };
                }
                docPost = { ...docPost, nextPage } as DocPost;
            }

            if (index > 0) {
                if (!structuredPosts[index - 1]?.isRootElement && !structuredPosts[index - 1]?.isSection) {
                    prevPage = {
                        title: structuredPosts[index - 1].title,
                        href: structuredPosts[index - 1].slug
                    };
                } else if (index - 2 >= 0) {
                    prevPage = {
                        title: `${structuredPosts[index - 1]?.isRootSection ? rootSections[rootSections.length - 2] : rootSections[rootSections.length - 1]} - ${structuredPosts[index - 2].title}`,
                        href: structuredPosts[index - 2].slug
                    };
                }
                docPost = { ...docPost, prevPage } as DocPost;
            }
            return docPost;
        });

    } catch (err) {
        throw new Error(`An error occurred while adding doc buttons: ${err instanceof Error ? err.message : String(err)}`);
    }
    return structuredPosts;
}
