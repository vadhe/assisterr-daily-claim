import fetch from 'node-fetch';
import readline from 'readline';
import { writeFile } from 'fs/promises';
import { readFile } from 'fs/promises';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6614.99 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0'
];

const COUNTDOWN_MINUTES = 12;
const COUNTDOWN_MILLISECONDS = COUNTDOWN_MINUTES * 60 * 1000;

const getRandomUserAgent = () => {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

const askQuestion = (query) => {
    return new Promise(resolve => rl.question(query, resolve));
};

const refreshToken = async () => {
    
    const refreshHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await readFile('accessToken.txt', 'utf8')}`,
        'User-Agent': getRandomUserAgent()
    };

    try {
        const refreshResponse = await fetch("https://api.assisterr.ai/incentive/auth/refresh_token/", {
            method: 'POST',
            headers: refreshHeaders,
            body: JSON.stringify({ refresh_token: ` ${await readFile('refreshToken.txt', 'utf8')}` })
        });

        const refreshData = await refreshResponse.json();
        await writeFile('accessToken.txt', refreshData.access_token);
        await writeFile('refreshToken.txt', refreshData.refresh_token);
        return refreshData.access_token;
    } catch (error) {
        console.error('Token refresh error:', error);
        throw error;
    }
};

const getDailyPoints = async () => {
    let headers = {
        'Accept': 'application/json, text/plain, */*',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Authorization': `Bearer  ${await readFile('accessToken.txt', 'utf8')}`,
        'User-Agent': getRandomUserAgent()
    };

    try {
        const response = await fetch("https://api.assisterr.ai/incentive/users/me/daily_points/", {
            method: 'POST',
            headers: headers
        });

        const data = await response.json();

        if (data.detail === 'Token expired') {
            const newToken = await refreshToken();
            headers.Authorization = `Bearer ${newToken}`;

            const retryResponse = await fetch("https://api.assisterr.ai/incentive/users/me/daily_points/", {
                method: 'POST',
                headers: headers
            });

            const retryData = await retryResponse.json();
            console.log('Response after token refresh:', retryData);
            return newToken;
        } else {
            console.log('Response:', data);
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

const startContinuousExecution = async () => {
    const executeAndScheduleNext = async () => {
        const newToken = await getDailyPoints();
        console.log(`Next execution in ${COUNTDOWN_MINUTES} minutes...`);
        setTimeout(() => executeAndScheduleNext(newToken), COUNTDOWN_MILLISECONDS);
    };

    executeAndScheduleNext();
};

const main = async () => {
    try {
        const accessToken = await askQuestion('Enter Access Token: ');
        const refreshTokenValue = await askQuestion('Enter Refresh Token: ');
        await writeFile('accessToken.txt', accessToken);
        await writeFile('refreshToken.txt', refreshTokenValue);
        startContinuousExecution();
    } catch (error) {
        console.error('Initialization error:', error);
    }
};

main();