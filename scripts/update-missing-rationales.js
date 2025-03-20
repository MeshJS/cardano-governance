const fs = require('fs');
const path = require('path');

// Function to parse a markdown table into an object
function parseMarkdownTable(content) {
    const lines = content.split('\n').filter(line => line.trim());

    // Find the header line and separator line
    const headerLine = lines[0];
    const separatorLine = lines[1];

    // Get headers from the first line
    const headers = headerLine.split('|')
        .map(h => h.trim())
        .filter(h => h);

    // Get the separator line to determine column widths
    const separatorCells = separatorLine.split('|')
        .map(c => c.trim())
        .filter(c => c);

    // Find the first data line (after the separator)
    const dataLineIndex = lines.findIndex((line, index) => {
        if (index <= 1) return false; // Skip header and separator
        const cells = line.split('|')
            .map(c => c.trim())
            .filter(c => c);
        return cells.length === headers.length;
    });

    if (dataLineIndex === -1) {
        console.log('No data line found in table');
        return {};
    }

    // Parse the data line
    const dataLine = lines[dataLineIndex];
    const values = dataLine.split('|')
        .map(v => v.trim())
        .filter(v => v);

    // Create result object
    const result = {};
    headers.forEach((header, index) => {
        result[header] = values[index];
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
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : null;
    // Return null if the rationale is "No rationale available"
    return rationale === 'No rationale available' ? null : rationale;
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

    console.log('Reading missing rationales from:', missingRationalesDir);

    // Read all files in missing-voting-rationales directory
    const missingRationaleFiles = fs.readdirSync(missingRationalesDir)
        .filter(file => file.endsWith('.md') && file !== 'vote-template.md');

    console.log('Found missing rationale files:', missingRationaleFiles);

    // Create a map of governance action IDs to rationales
    const rationaleMap = new Map();
    for (const file of missingRationaleFiles) {
        const filePath = path.join(missingRationalesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`\nProcessing file: ${file}`);

        const parsed = parseMarkdownTable(content);
        console.log('Parsed data:', parsed);

        // Look for either 'Governance Action ID' or 'Action ID'
        const actionId = parsed['Governance Action ID'] || parsed['Action ID'];
        const rationale = parsed['Rational'] || parsed['Rationale'];

        if (actionId) {
            rationaleMap.set(actionId, rationale);
            console.log(`Added rationale for action ID: ${actionId}`);
            console.log(`Rationale: ${rationale}`);
        } else {
            console.log('No Action ID found in file');
            console.log('Available fields:', Object.keys(parsed));
        }
    }

    console.log('\nRationale map:', Object.fromEntries(rationaleMap));

    // Process each voting history file
    const years = fs.readdirSync(votingHistoryDir)
        .filter(dir => /^\d{4}$/.test(dir));

    console.log('\nProcessing years:', years);

    for (const year of years) {
        const votesFile = path.join(votingHistoryDir, year, `${year}-votes.md`);
        if (!fs.existsSync(votesFile)) continue;

        console.log(`\nProcessing votes file: ${votesFile}`);
        let content = fs.readFileSync(votesFile, 'utf8');
        const entries = content.split('---\n\n').filter(entry => entry.trim());

        let updated = false;
        const updatedEntries = entries.map(entry => {
            const actionId = extractGovernanceActionId(entry);
            if (!actionId) {
                console.log('No Action ID found in entry');
                return entry;
            }

            console.log(`\nProcessing entry with Action ID: ${actionId}`);
            const currentRationale = extractRationale(entry);
            console.log('Current rationale:', currentRationale);

            // Only skip if there's a valid rationale
            if (currentRationale) {
                console.log('Entry already has a valid rationale, skipping');
                return entry;
            }

            const newRationale = rationaleMap.get(actionId);
            if (newRationale) {
                console.log('Found new rationale:', newRationale);
                updated = true;
                return updateRationale(entry, newRationale);
            } else {
                console.log('No matching rationale found in map');
            }
            return entry;
        });

        if (updated) {
            const newContent = updatedEntries.join('---\n\n');
            fs.writeFileSync(votesFile, newContent);
            console.log(`Updated rationales in ${votesFile}`);
        } else {
            console.log('No updates needed for this file');
        }
    }
}

// Run the script
updateMissingRationales().catch(console.error); 