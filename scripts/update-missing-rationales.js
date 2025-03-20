const fs = require('fs');
const path = require('path');

// Function to parse a markdown table into an object
function parseMarkdownTable(content) {
    const lines = content.split('\n');
    const headers = lines[0].split('|').filter(h => h.trim());
    const values = lines[1].split('|').filter(v => v.trim());

    const result = {};
    headers.forEach((header, index) => {
        result[header.trim()] = values[index].trim();
    });
    return result;
}

// Function to extract governance action ID from a voting history entry
function extractGovernanceActionId(content) {
    const actionIdMatch = content.match(/Action ID\s+\|\s+(gov_action[^\n]+)/);
    return actionIdMatch ? actionIdMatch[1].trim() : null;
}

// Function to extract rationale from a voting history entry
function extractRationale(content) {
    const rationaleMatch = content.match(/(?:Rational|Rationale)\s+\|\s+([^\n]+)/);
    return rationaleMatch ? rationaleMatch[1].trim() : null;
}

// Function to update rationale in content
function updateRationale(content, newRationale) {
    return content.replace(
        /(?:Rational|Rationale)\s+\|\s+[^\n]+/,
        `Rational       | ${newRationale}`
    );
}

// Main function to process files
async function updateMissingRationales() {
    const votingHistoryDir = path.join(__dirname, '../voting-history');
    const missingRationalesDir = path.join(__dirname, '../voting-history/missing-voting-rationales');

    // Read all files in missing-voting-rationales directory
    const missingRationaleFiles = fs.readdirSync(missingRationalesDir)
        .filter(file => file.endsWith('.md') && file !== 'vote-template.md');

    // Create a map of governance action IDs to rationales
    const rationaleMap = new Map();
    for (const file of missingRationaleFiles) {
        const content = fs.readFileSync(path.join(missingRationalesDir, file), 'utf8');
        const parsed = parseMarkdownTable(content);
        if (parsed['Governance Action ID']) {
            rationaleMap.set(parsed['Governance Action ID'], parsed['Rational']);
        }
    }

    // Process each voting history file
    const years = fs.readdirSync(votingHistoryDir)
        .filter(dir => /^\d{4}$/.test(dir));

    for (const year of years) {
        const votesFile = path.join(votingHistoryDir, year, `${year}-votes.md`);
        if (!fs.existsSync(votesFile)) continue;

        let content = fs.readFileSync(votesFile, 'utf8');
        const entries = content.split('---\n\n').filter(entry => entry.trim());

        let updated = false;
        const updatedEntries = entries.map(entry => {
            const actionId = extractGovernanceActionId(entry);
            if (!actionId) return entry;

            const currentRationale = extractRationale(entry);
            if (currentRationale && currentRationale !== 'No rationale available') return entry;

            const newRationale = rationaleMap.get(actionId);
            if (newRationale) {
                updated = true;
                return updateRationale(entry, newRationale);
            }
            return entry;
        });

        if (updated) {
            const newContent = updatedEntries.join('---\n\n');
            fs.writeFileSync(votesFile, newContent);
            console.log(`Updated rationales in ${votesFile}`);
        }
    }
}

// Run the script
updateMissingRationales().catch(console.error); 