import fetch from 'node-fetch';
import readline from 'readline';
import { writeFile, readFile } from 'fs/promises';

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

const COUNTDOWN_HOURS = 12; // 12 hours countdown after each claim
const COUNTDOWN_MILLISECONDS = COUNTDOWN_HOURS * 60 * 60 * 1000; // 12 hours in milliseconds

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
            body: JSON.stringify({ refresh_token: `${await readFile('refreshToken.txt', 'utf8')}` })
        });

        const refreshData = await refreshResponse.json();

        if (!refreshData.access_token || !refreshData.refresh_token) {
            console.error('Error: Invalid response data', refreshData);
            throw new Error('Invalid token data received from refresh API.');
        }

        console.log('New access token:', refreshData.access_token);
        console.log('New refresh token:', refreshData.refresh_token);

        await writeFile('accessToken.txt', refreshData.access_token);
        await writeFile('refreshToken.txt', refreshData.refresh_token);

        return refreshData.access_token;
    } catch (error) {
        console.error('Token refresh error:', error);
        throw error;
    }
};

const claimDailyPoints = async () => {
    let headers = {
        'Accept': 'application/json, text/plain, */*',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await readFile('accessToken.txt', 'utf8')}`,
        'User-Agent': getRandomUserAgent()
    };

    try {
        const response = await fetch("https://api.assisterr.ai/incentive/users/me/daily_points/", {
            method: 'POST',
            headers: headers
        });

        const data = await response.json();

        if (data.detail === 'Token expired') {
            console.log('Token expired, refreshing...');
            const newToken = await refreshToken();
            headers.Authorization = `Bearer ${newToken}`;

            const retryResponse = await fetch("https://api.assisterr.ai/incentive/users/me/daily_points/", {
                method: 'POST',
                headers: headers
            });

            const retryData = await retryResponse.json();
            if (retryData.success) {
                console.log('Claim successful after token refresh:', retryData);
                return true;
            } else {
                console.error('Claim failed after token refresh:', retryData);
                return false;
            }
        } else if (data.success) {
            console.log('Claim successful:', data);
            return true;
        } else {
            console.error('Claim failed:', data);
            return false;
        }
    } catch (error) {
        console.error('Error while claiming:', error);
        return false;
    }
};

const startContinuousExecution = async () => {
    const executeAndScheduleNext = async () => {
        const claimSuccess = await claimDailyPoints();
        
        if (claimSuccess) {
            console.log(`Next claim in ${COUNTDOWN_HOURS} hours...`);
            setTimeout(() => executeAndScheduleNext(), COUNTDOWN_MILLISECONDS);
        } else {
            console.log('Error with claiming. Retrying in 1 hour...');
            setTimeout(() => executeAndScheduleNext(), 60 * 60 * 1000); // Retry in 1 hour if something goes wrong
        }
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