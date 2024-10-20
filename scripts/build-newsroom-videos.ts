import { writeFileSync } from 'fs';
import { resolve } from 'path';
const fetch = require('node-fetch-2');

interface YouTubeVideo {
    image_url: string;
    title: string;
    description: string;
    videoId: string;
}

interface YouTubeResponse {
    items: Array<{
        id: {
            videoId: string;
        };
        snippet: {
            title: string;
            description: string;
            thumbnails: {
                high: {
                    url: string;
                };
            };
        };
    }>;
}

async function buildNewsroomVideos(writePath: string): Promise<string> {
    try {
        const response = await fetch('https://youtube.googleapis.com/youtube/v3/search?' + new URLSearchParams({
            key: process.env.YOUTUBE_TOKEN || '',
            part: 'snippet',
            channelId: 'UCIz9zGwDLbrYQcDKVXdOstQ',
            eventType: 'completed',
            type: 'video',
            order: 'date',
            maxResults: '5',
        }));

        if (!response.ok) {
            throw new Error(`HTTP error! with status code: ${response.status}`);
        }

        const data: YouTubeResponse = await response.json();

        console.log(data);

        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Invalid data structure received from YouTube API');
        }

        const videoDataItems: YouTubeVideo[] = data.items.map((video) => ({
            image_url: video.snippet.thumbnails.high.url,
            title: video.snippet.title,
            description: video.snippet.description,
            videoId: video.id.videoId,
        }));

        const videoData = JSON.stringify(videoDataItems, null, '  ');
        console.log('The following are the Newsroom Youtube videos: ', videoData);

        writeFileSync(writePath, videoData);

        return videoData;
    } catch (err: any) {
        throw new Error(`Failed to build newsroom videos: ${err.message}`);
    }
}

/* istanbul ignore next */
if (require.main === module) {
    buildNewsroomVideos(resolve(__dirname, '../config', 'newsroom_videos.json')).catch(err => {
        console.error(err);
    });
}

export { buildNewsroomVideos };
