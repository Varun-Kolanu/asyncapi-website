import { getData } from './tools/extract-tools-github';
import { convertTools } from './tools/tools-object';
import { combineTools } from './tools/combine-tools';
import fs from 'fs';
import { resolve } from 'path';

const buildTools = async (
    automatedToolsPath: string,
    manualToolsPath: string,
    toolsPath: string,
    tagsPath: string
): Promise<void> => {
    try {
        const githubExtractData = await getData();
        const automatedTools = await convertTools(githubExtractData);

        fs.writeFileSync(
            automatedToolsPath,
            JSON.stringify(automatedTools, null, '  ')
        );

        await combineTools(automatedTools, require(manualToolsPath), toolsPath, tagsPath);
    } catch (err: any) {
        throw new Error(`An error occurred while building tools: ${err.message}`);
    }
}

/* istanbul ignore next */
if (require.main === module) {
    const automatedToolsPath = resolve(__dirname, '../config', 'tools-automated.json');
    const manualToolsPath = resolve(__dirname, '../config', 'tools-manual.json');
    const toolsPath = resolve(__dirname, '../config', 'tools.json');
    const tagsPath = resolve(__dirname, '../config', 'all-tags.json');

    buildTools(automatedToolsPath, manualToolsPath, toolsPath, tagsPath).catch(err => {
        console.error(err);
    });
}

export { buildTools };
