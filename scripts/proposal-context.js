require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Read config file
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const drepId = config.drepId;

if (!drepId) {
    console.error('DRep ID not found in config.json');
    process.exit(1);
}

// Create voting-history directory if it doesn't exist
const votingHistoryDir = path.join(__dirname, '..', 'voting-history');
if (!fs.existsSync(votingHistoryDir)) {
    fs.mkdirSync(votingHistoryDir, { recursive: true });
}

// Create vote_context directory inside voting-history if it doesn't exist
const voteContextDir = path.join(votingHistoryDir, 'vote-context');
if (!fs.existsSync(voteContextDir)) {
    fs.mkdirSync(voteContextDir, { recursive: true });
}

async function getProposalList() {
    try {
        const response = await axios.get('https://api.koios.rest/api/v1/proposal_list', {
            headers: {
                'accept': 'application/json'
            }
        });

        if (!Array.isArray(response.data)) {
            throw new Error('Invalid response format: expected an array');
        }

        console.log(`Found ${response.data.length} total proposals`);
        return response.data;
    } catch (error) {
        console.error('Error fetching proposal list:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        return [];
    }
}

async function getVotedProposals(drepId) {
    try {
        const apiKey = process.env.KOIOS_API_KEY;
        if (!apiKey) {
            throw new Error('KOIOS_API_KEY environment variable is not set');
        }

        const response = await axios.get(`https://api.koios.rest/api/v1/voter_proposal_list?_voter_id=${drepId}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'accept': 'application/json'
            }
        });

        if (!Array.isArray(response.data)) {
            throw new Error('Invalid response format: expected an array');
        }

        console.log(`Found ${response.data.length} voted proposals`);
        return response.data;
    } catch (error) {
        console.error('Error fetching voted proposals:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        return [];
    }
}

function createContextFolder(proposal) {
    // Get current date in MM_DD format
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Get last 4 digits of proposal_id
    const proposalId = proposal.proposal_id;
    const lastFourDigits = proposalId.slice(-4);

    // Create folder name in format MM_DD_2kXX
    const folderName = `${month}_${day}_${lastFourDigits}`;

    // Create year folder
    const year = date.getFullYear().toString();
    const yearDir = path.join(voteContextDir, year);
    if (!fs.existsSync(yearDir)) {
        fs.mkdirSync(yearDir, { recursive: true });
    }

    // Create context folder
    const contextFolder = path.join(yearDir, folderName);
    if (!fs.existsSync(contextFolder)) {
        fs.mkdirSync(contextFolder, { recursive: true });
    }

    return contextFolder;
}

async function generateContextFile(proposal, contextFolder) {
    // Read the sample context file
    const sampleContextPath = path.join(votingHistoryDir, 'vote-context', 'sample_context.jsonId');
    let contextData;
    try {
        contextData = JSON.parse(fs.readFileSync(sampleContextPath, 'utf8'));
    } catch (error) {
        console.error('Error reading sample context file:', error.message);
        process.exit(1);
    }

    const filePath = path.join(contextFolder, 'Vote_Context.jsonId');
    fs.writeFileSync(filePath, JSON.stringify(contextData, null, 2));
    console.log(`Generated context file for proposal ${proposal.proposal_id}`);
}

async function processProposals() {
    try {
        // Get all proposals and voted proposals
        const [allProposals, votedProposals] = await Promise.all([
            getProposalList(),
            getVotedProposals(drepId)
        ]);

        // Create a set of voted proposal IDs for quick lookup
        const votedProposalIds = new Set(votedProposals.map(p => p.proposal_id));

        // Filter out proposals we've already voted on
        const unvotedProposals = allProposals.filter(proposal => !votedProposalIds.has(proposal.proposal_id));

        console.log(`Found ${unvotedProposals.length} proposals that need voting context`);

        // Generate context files for each unvoted proposal
        for (const proposal of unvotedProposals) {
            const contextFolder = createContextFolder(proposal);
            await generateContextFile(proposal, contextFolder);
        }

        console.log('Successfully processed all proposals');
    } catch (error) {
        console.error('Error processing proposals:', error.message);
        process.exit(1);
    }
}

processProposals(); 