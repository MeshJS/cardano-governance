const fs = require('fs');
const path = require('path');

// Function to extract governance action ID from a voting history entry
function extractGovernanceActionId(content) {
    // Match gov_action followed by base32 characters until whitespace or end of line
    // Handle multiple spaces after the pipe character
    const actionIdMatch = content.match(/\| Action ID\s+\|\s+(gov_action[a-zA-Z2-7]+)/);

    // Debug logging
    if (actionIdMatch) {
        console.log('Found match:', actionIdMatch[1]);
    } else {
        console.log('No match found');
    }

    return actionIdMatch ? actionIdMatch[1].trim() : null;
}

// Function to extract rationale from a voting history entry
function extractRationale(content) {
    // Look for Rational or Rationale followed by a pipe and any characters until the next pipe or newline
    const rationaleMatch = content.match(/(?:Rational|Rationale)\s+\|\s+([^|\n]+)/);
    const rationale = rationaleMatch ? rationaleMatch[1].trim() : null;
    // Return null if the rationale is "No rationale available" or empty
    return (!rationale || rationale === 'No rationale available') ? null : rationale;
}

// Function to update rationale in content
function updateRationale(content, newRationale) {
    // Match Rational or Rationale followed by a pipe and any characters until the next pipe or newline
    return content.replace(
        /(?:Rational|Rationale)\s+\|\s+[^|\n]+/,
        `Rational       | ${newRationale}`
    );
}

// Function to debug content structure
function debugContent(content) {
    console.log('\nContent structure:');
    console.log('Length:', content.length);
    console.log('First 100 chars:', content.substring(0, 100));
    console.log('Contains "Action ID":', content.includes('Action ID'));
    console.log('Contains "gov_action":', content.includes('gov_action'));
    console.log('Character codes:');
    for (let i = 0; i < Math.min(100, content.length); i++) {
        console.log(`${i}: ${content.charCodeAt(i)} ('${content[i]}')`);
    }
}

// Main function to process files
async function updateMissingRationales() {
    const votingHistoryDir = path.join(__dirname, '../voting-history');
    const rationalesFile = path.join(__dirname, '../voting-history/missing-voting-rationales/rationales.json');

    console.log('Reading rationales from:', rationalesFile);

    // Read the rationales JSON file
    const rationales = JSON.parse(fs.readFileSync(rationalesFile, 'utf8'));
    console.log('Loaded rationales for', Object.keys(rationales).length, 'actions');

    // Process each voting history file
    const years = fs.readdirSync(votingHistoryDir)
        .filter(dir => /^\d{4}$/.test(dir));

    console.log('\nProcessing years:', years);

    for (const year of years) {
        const votesFile = path.join(votingHistoryDir, year, `${year}-votes.md`);
        if (!fs.existsSync(votesFile)) continue;

        console.log(`\nProcessing votes file: ${votesFile}`);
        let content = fs.readFileSync(votesFile, 'utf8');

        // Split content into entries, skipping the header
        const lines = content.split('\n');
        const entries = [];
        let currentEntry = [];
        let foundFirstEntry = false;

        for (const line of lines) {
            if (line.startsWith('| MeshJS') && !foundFirstEntry) {
                foundFirstEntry = true;
            }

            if (foundFirstEntry) {
                if (line.trim() === '---') {
                    if (currentEntry.length > 0) {
                        entries.push(currentEntry.join('\n'));
                        currentEntry = [];
                    }
                } else {
                    currentEntry.push(line);
                }
            }
        }

        // Add the last entry if it exists
        if (currentEntry.length > 0) {
            entries.push(currentEntry.join('\n'));
        }

        let updated = false;
        const updatedEntries = entries.map(entry => {
            const actionId = extractGovernanceActionId(entry);
            if (!actionId) {
                console.log('No Action ID found in entry');
                return entry;
            }

            // Trim the action ID to remove any whitespace
            const trimmedActionId = actionId.trim();
            console.log(`\nProcessing entry with Action ID: ${trimmedActionId}`);
            const currentRationale = extractRationale(entry);
            console.log('Current rationale:', currentRationale);

            // Skip only if there's a valid rationale (not null)
            if (currentRationale) {
                console.log('Entry already has a valid rationale, skipping');
                return entry;
            }

            const rationaleData = rationales[trimmedActionId];
            if (rationaleData) {
                console.log('Found new rationale:', rationaleData.rationale);
                updated = true;
                return updateRationale(entry, rationaleData.rationale);
            } else {
                console.log('No matching rationale found in map');
                console.log('Looking for:', trimmedActionId);
                console.log('Available action IDs:', Object.keys(rationales));
            }
            return entry;
        });

        if (updated) {
            // Reconstruct the file content with the header
            const header = lines.slice(0, lines.findIndex(line => line.startsWith('| MeshJS')));
            const newContent = header.join('\n') + '\n\n' + updatedEntries.join('\n\n---\n\n');
            fs.writeFileSync(votesFile, newContent);
            console.log(`Updated rationales in ${votesFile}`);
        } else {
            console.log('No updates needed for this file');
        }
    }
}

// Run the script
updateMissingRationales().catch(console.error); 